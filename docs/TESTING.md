# Testing

```bash
npm test          # single run
npm run test:watch
```

**40 tests, 7 files, all passing** as of this build (verified by actually
running `vitest run` — see the implementation report for the raw output).

## What's covered

| Area | File | Covers |
| --- | --- | --- |
| Google ID token verification | `test/google-oauth.test.ts` | Valid token accepted; untrusted signing key, wrong issuer, wrong audience, expired token, nonce mismatch, unverified email, and missing `sub` are all rejected — against a **real JWKS-based signature check** (a real RS256 keypair is generated per test run and `jose`'s real `jwtVerify` runs; only the network fetch of Google's JWKS is swapped for a local one) |
| Open-redirect prevention | `test/safeRedirect.test.ts` | Absolute URLs, protocol-relative URLs, backslash tricks, and percent-encoded scheme smuggling are all rejected. This test suite caught a real bug during development (`/%68ttps://evil.com` wasn't being rejected) — see `docs/SECURITY.md` |
| Auth/role/permission guards | `test/guards.test.ts` | 401 with no session, 403 for role/permission mismatch, `ADMIN` superset behavior |
| Rate limiting | `test/rateLimit.test.ts` | In-memory fallback path: allows under the limit, blocks over it, tracks identifiers independently |
| Secret redaction | `test/logger.test.ts` | Top-level and nested sensitive keys redacted; NVIDIA key env-var-style names redacted regardless of casing; non-sensitive data untouched |
| Crypto helpers | `test/crypto.test.ts` | Token uniqueness/entropy, deterministic hashing, constant-time comparison |
| NVIDIA AI provider | `test/nvidia-provider.test.ts` | Missing credentials, successful response + usage parsing, retry-then-succeed on 5xx, no-retry on 4xx, 429→`RATE_LIMITED` after exhausting retries, abort→`TIMEOUT`, malformed response→`INVALID_RESPONSE`, unhealthy when credentials absent — and asserts the API key only ever appears in the outbound `Authorization` header, never elsewhere |

## What is **not** covered, and why

The spec asked for tests against new/returning users, suspended-user login,
logout, logout-all, session expiry/revocation, and concurrent first-login —
all of which live in `src/db/repositories/*.ts` and the API routes that call
them. **These require a real PostgreSQL instance** (or a mocked
`drizzle-orm` query builder faithful enough to be trustworthy, which is
easy to get subtly wrong and end up testing the mock instead of the
behavior). This sandbox has no live database to run integration tests
against, so rather than fabricate passing tests or ship low-value mocked
DB tests, this is left as explicit follow-up work:

**Recommended next step**: add `test/integration/*.test.ts` using
`@testcontainers/postgresql` (or point `DATABASE_URL` at the
`docker-compose.yml` Postgres in CI) and cover, against a real database:

- New user created on first Google login
- Returning user: profile fields sync, `role`/`status` do *not* get
  overwritten
- Two concurrent callbacks for the same `google_sub` produce exactly one
  user row (the `ON CONFLICT DO NOTHING` path in
  `createOrGetUserFromGoogle`)
- Suspended user is blocked at the callback and their session, if any, is
  not created
- `logout` revokes only the current session; `logout-all` revokes every
  session for that user; a revoked/expired session fails
  `findActiveSessionByToken`
- `DELETE /api/auth/sessions/:id` for a session belonging to a different
  user returns 404, not 403 (IDOR-safe — doesn't confirm existence)

None of this is unusually hard to add — the repository functions
(`src/db/repositories/*.ts`) are already isolated from the route handlers
specifically so they're easy to call directly in an integration test.
