# Security Considerations

## OAuth/OIDC hardening implemented

- **State**: random per-flow value, stored in a 10-minute HttpOnly cookie,
  compared to the callback's `state` param with a constant-time comparison
  (`safeEqual`) — not `===`, to avoid timing side-channels.
- **PKCE**: S256 code challenge/verifier on every flow (not conditional on
  client type — this app always uses it).
- **Nonce**: bound into the ID token and checked after signature
  verification.
- **ID token verification** (`src/lib/oauth/google.ts`): signature checked
  against Google's live JWKS, `iss` restricted to Google's known issuer
  strings, `aud` restricted to this app's `GOOGLE_CLIENT_ID`, expiry
  enforced by `jose`, `email_verified` required. See
  `test/google-oauth.test.ts` for the adversarial cases actually exercised
  (wrong issuer, wrong audience, expired, untrusted signing key, nonce
  mismatch, unverified email, missing `sub`).
- **Open-redirect prevention** (`src/lib/safeRedirect.ts`): `returnTo` is
  only ever allowed to be a same-origin relative path. **This test suite
  caught a real bug during development**: an early version's regex checked
  for a URL scheme only at the *start* of the decoded string, so
  `/%68ttps://evil.com` (decodes to `/https://evil.com`) slipped through.
  Fixed by anchoring the scheme check to immediately-after-the-leading-slash
  instead. Left in `docs/TESTING.md` and here deliberately, instead of
  quietly fixing it — this is exactly the kind of near-miss production
  security docs should surface, not hide.

## Session security

- Session token: 256 bits of randomness (`crypto.randomBytes(32)`),
  transmitted only via HttpOnly, `Secure` (in production), `SameSite=Lax`
  cookie — never in a response body, never in `localStorage`.
- Only `sha256(token)` is stored in Postgres; a database read alone cannot
  produce a valid session cookie.
- Revocation is immediate and authoritative: every request re-checks
  `revoked_at`/`expires_at`/user `status` against the database — there is no
  window where a revoked session keeps working because of client-side
  caching.
- `DELETE /api/auth/sessions/:id` returns `404` (not `403`) for a session ID
  that exists but belongs to another user — this avoids confirming to an
  attacker that a given session ID is valid at all (IDOR-safe error
  behavior).

## CSRF

State-changing endpoints (`logout`, `logout-all`, `sessions/:id` DELETE) are
protected primarily by `SameSite=Lax` on the session cookie, which blocks
the cookie from being sent on cross-site POST/DELETE requests from another
origin. `SameSite=Lax` still allows the cookie on top-level cross-site GET
navigations (by design, for OAuth redirects to work at all) — the OAuth
callback itself is protected by the `state` check instead, not by
`SameSite`. **Not yet implemented**: a double-submit CSRF token for the
mutating endpoints, which would add defense-in-depth beyond `SameSite`
alone. Recommended before handling anything more sensitive than
session/account management (e.g. payments).

## Headers (`next.config.ts`)

`Content-Security-Policy`, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy`, a restrictive
`Permissions-Policy`, and HSTS are set globally. The CSP's `connect-src` and
`img-src` allowlist only the origins this app currently talks to
(`accounts.google.com`, `oauth2.googleapis.com`,
`lh3.googleusercontent.com` for Google avatar images, Google Fonts). **You
must extend this allowlist** as future modules add real external calls
(e.g. if a module renders NVIDIA-hosted images) — don't loosen `default-src`
to compensate; add specific origins to the specific directive instead.

## Secrets

- `.env.example` contains variable names only; `.gitignore` excludes every
  `.env*` file except `.env.example` itself.
- `src/lib/logger.ts` redacts known-sensitive keys both via pino's built-in
  `redact` (fast path for known object shapes like `req.headers.cookie`) and
  a recursive `redactSecrets()` deep-scan fallback for ad-hoc objects
  assembled at call sites — so a forgotten path in the first doesn't leak a
  secret. Covered by `test/logger.test.ts`.
- The NVIDIA API key is read only inside `NvidiaAIProvider`/`modelRegistry`,
  sent only in the outbound `Authorization` header, and never logged — see
  the assertion in `test/nvidia-provider.test.ts` that checks the key
  appears nowhere except that one header.
- Authorization codes, ID tokens, and access tokens from Google are never
  logged — `oauth/google.ts`'s error paths log an error *code*
  (`invalid_id_token`, `state_mismatch`, etc.), never the token/code value
  itself.

## SQL injection / IDOR

All database access goes through Drizzle's query builder (parameterized
queries) — no raw string-concatenated SQL exists in this codebase.
Ownership is checked at the query level, not just presentationally: e.g.
`revokeSessionById` filters `WHERE id = ? AND user_id = ?` in a single
query, so a user can't revoke another user's session by guessing a UUID.

## Known limitations / recommended next steps

- **No CSRF token** beyond `SameSite=Lax` (see above).
- **No database-integration test suite** — see `docs/TESTING.md` for
  exactly what's missing and why (no live Postgres in the build sandbox)
  and the concrete tests recommended as follow-up.
- **No admin UI** to suspend/disable a user — `users.status` is fully
  modeled and enforced, but nothing currently writes anything other than
  `ACTIVE` to it.
- **No IP-based anomaly detection** (e.g. "new device from new country") —
  `login_history` and `security_events` capture the raw data needed to add
  this later, but no alerting/blocking logic consumes it yet.
- **NVIDIA model IDs are placeholders** — confirm against NVIDIA's live
  catalog before production use (see `docs/AI_PROVIDER.md`).
- **CSP's `style-src` allows `'unsafe-inline'`** for Google Fonts'
  stylesheet and a few inline `style={}` props on placeholder pages;
  tightening this to a nonce-based policy is straightforward but wasn't
  done here to keep the initial CSP simple to reason about — worth doing
  before this becomes a public-facing production surface.
