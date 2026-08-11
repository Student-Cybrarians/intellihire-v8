# Authorization Model

## Roles

Two roles exist today: `USER` (default for every new sign-in) and `ADMIN`
(granted manually — there is no self-service path to become an admin).
`ADMIN` is treated as a superset of every role and every permission check
(see `src/lib/auth/guards.ts`), so admin tooling doesn't need a second guard
per role.

## Guards

Three composable guards wrap Next.js route handlers:

```ts
export const GET = requireAuth(async (auth, request) => { /* ... */ });
export const POST = requireRole("ADMIN", async (auth, request) => { /* ... */ });
export const DELETE = requirePermission("users:suspend", async (auth, request) => { /* ... */ });
```

- **`requireAuth`** — resolves the session via `getCurrentAuth()`; 401s if
  there's no valid, unexpired, unrevoked session for an `ACTIVE` user.
- **`requireRole(role, handler)`** — additionally requires the exact role
  (or `ADMIN`); 403s otherwise.
- **`requirePermission(permission, handler)`** — forward-compatible stub for
  a future granular-permissions table. Today, `ADMIN` holds every permission
  and `USER` holds none. When real per-permission rows exist, only this
  function's internals change — every call site (`requirePermission("users:suspend", ...)`)
  stays the same.

Every protected API route in this repo uses one of these three — none
re-implements its own session check.

## Page-level protection

`src/proxy.ts` (Edge) redirects unauthenticated requests to `/dashboard/*`
and `/admin/*` before they render, using cookie *presence* only (Edge can't
reach Postgres). Each page then calls `getCurrentAuth()` itself for the
authoritative check — see `src/app/dashboard/page.tsx` and
`src/app/admin/page.tsx` — and redirects again if the session turns out to
be invalid, or if an `admin`-only page is hit by a non-admin. This two-layer
approach means a stale/forged cookie can get you *past the proxy* but never
past the actual page/route logic.

## Suspended and disabled accounts

`users.status` (`ACTIVE | SUSPENDED | DISABLED | DELETED`) is checked in two
places:

1. In the OAuth callback — a non-`ACTIVE` user is blocked from completing
   login at all, with a `login_history` and `security_events` row recorded.
2. In `getCurrentAuth()` — even an existing valid session cookie stops
   authenticating the moment the underlying user's status changes, because
   every request re-reads the user row.

There is currently no admin UI to change `status` — that's explicitly listed
as a known limitation / next step, not implemented here.
