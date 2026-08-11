# Architecture

## System overview

```mermaid
flowchart LR
    subgraph Browser
        U[Student]
    end

    subgraph Vercel/Node["Next.js app (server)"]
        Entry["/ entry page"]
        API["/api/auth/* route handlers"]
        Proxy["src/proxy.ts (edge)"]
        Guards["requireAuth / requireRole / requirePermission"]
        AI["aiService -> NvidiaAIProvider"]
    end

    subgraph Google
        GAuth["accounts.google.com"]
        GJWKS["Google JWKS (id_token verification)"]
    end

    subgraph Data
        PG[(PostgreSQL)]
        Redis[(Redis — optional)]
    end

    NVIDIA[("NVIDIA NIM API")]

    U -->|1. Continue with Google| Entry
    Entry -->|2. GET /api/auth/google| API
    API -->|3. redirect, state+nonce+PKCE| GAuth
    GAuth -->|4. redirect w/ code| API
    API -->|5. verify id_token| GJWKS
    API -->|6. upsert user, create session| PG
    API -->|rate limits, OAuth state cache| Redis
    U -->|7. session cookie| Proxy
    Proxy -->|coarse cookie check| Guards
    Guards -->|DB session lookup| PG
    AI -->|server-side only| NVIDIA
```

## Request flow: first login vs. returning login

```mermaid
sequenceDiagram
    participant B as Browser
    participant S as Next.js server
    participant G as Google
    participant D as PostgreSQL

    B->>S: GET /api/auth/google?returnTo=/dashboard
    S->>S: generate state, nonce, PKCE verifier/challenge
    S-->>B: Set-Cookie (state, nonce, verifier, returnTo) + redirect
    B->>G: authorization request (state, nonce, code_challenge)
    G-->>B: redirect with code + state
    B->>S: GET /api/auth/google/callback?code=...&state=...
    S->>S: constant-time compare state
    S->>G: POST /token (code, code_verifier)
    G-->>S: id_token
    S->>S: verify signature (JWKS), iss, aud, exp, nonce, email_verified
    S->>D: INSERT user ON CONFLICT (google_sub) DO NOTHING ... RETURNING
    alt insert succeeded
        D-->>S: new user row (first login)
    else conflict (already existed, or lost the race)
        S->>D: SELECT user WHERE google_sub = ?
        D-->>S: existing user row (returning login)
        S->>D: UPDATE name/avatar/email_verified only
    end
    S->>D: INSERT session (hash of opaque token), device, login_history
    S-->>B: Set-Cookie (session) + redirect to returnTo
```

## Session model

IntelliHire uses a **single server-managed session**, not a JWT access token
+ refresh token pair:

- The browser holds one opaque, high-entropy, HttpOnly, Secure, SameSite=Lax
  cookie (`ih_session`).
- The database stores only `sha256(token)` — never the raw token — in
  `sessions.token_hash`, alongside `user_id`, `device_id`, `expires_at`, and
  `revoked_at`.
- Every authenticated request does a DB lookup (`getCurrentAuth()`) to
  confirm the session is unexpired, unrevoked, and its owning user is
  `ACTIVE`.
- `POST /api/auth/refresh` performs **sliding-window renewal** — it pushes
  `expires_at` forward while the session is still valid, so an active user
  is never logged out mid-session. There is no separate refresh token to
  rotate because there is no separate access token to expire quickly.

This was a deliberate simplification versus the access+refresh pattern
described in the original spec: a single opaque server session, checked
against the DB on every request, gives equivalent revocation guarantees
(instant, because every request re-checks the DB) with a smaller attack
surface (no refresh-token-family reuse-detection bookkeeping). If a future
requirement needs stateless verification (e.g. a separate API server that
can't reach the session DB), swap in short-lived JWT access tokens issued
alongside the session — the `sessions` table's `token_hash` +
rotation-ready shape already supports that without a schema change.

## Edge proxy vs. server-side authorization

`src/proxy.ts` runs on the Edge runtime, which cannot reach PostgreSQL. It
does one job: reject requests to `/dashboard/*` and `/admin/*` that have no
session cookie at all, redirecting to `/` with a safe `returnTo`. It is a
fast UX layer, not a security boundary — the actual authorization decision
(is this session valid? is this user active? does this user hold the right
role?) happens in `getCurrentAuth()` and the `require*` guards, which run
server-side per request against the database. Every API route and every
protected page calls one of these guards directly; none re-implement their
own auth check.

## Why Drizzle instead of Prisma

Prisma's CLI downloads a native query-engine binary from
`binaries.prisma.sh` on `generate`/`migrate`. In network-restricted CI
runners or sandboxes without that domain allowlisted, those commands fail
outright. Drizzle is pure TypeScript — `drizzle-kit generate` computes SQL
migrations by diffing the schema file, no binary download, no live DB
connection required to generate a migration. This project's initial
migration (`drizzle/0000_*.sql`) was generated and inspected this way.
