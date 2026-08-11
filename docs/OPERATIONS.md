# Local Development, Environment Variables, Migrations, Redis

## Local development

```bash
cp .env.example .env.local     # then fill in GOOGLE_CLIENT_ID/SECRET, SESSION_SECRET, etc.
docker compose up -d           # Postgres on :5432, Redis on :6379
npm install
npm run db:migrate
npm run dev
```

`docker-compose.yml`'s Postgres credentials (`intellihire`/`intellihire`,
db `intellihire`) match `.env.example`'s default `DATABASE_URL` — no edits
needed for a first run. Redis is optional; if you skip `docker compose up`
entirely, leave `REDIS_URL` unset and the app runs with the in-memory
rate-limit fallback (see `docs/ARCHITECTURE.md`).

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | — | `development` \| `test` \| `production` |
| `APP_URL` | ✅ | Public origin of this app; used to build redirect targets |
| `API_URL` | — | Defaults to `APP_URL` if your API is served from the same origin |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | — | If unset, rate limiting falls back to in-memory (per-instance, best-effort) |
| `GOOGLE_CLIENT_ID` | ✅ | From Google Cloud Console — see `GOOGLE_OAUTH_SETUP.md` |
| `GOOGLE_CLIENT_SECRET` | ✅ | Real secret — set via your platform's secret manager |
| `GOOGLE_REDIRECT_URI` | ✅ | Must exactly match an Authorized redirect URI in Google Cloud Console |
| `SESSION_SECRET` | ✅ | 32+ random chars — generate with `openssl rand -base64 48`. Currently reserved for future cookie-signing use; sessions are validated via DB lookup today (see ARCHITECTURE.md), not by verifying a signature on this secret. |
| `NVIDIA_API_KEY_NEMOTRON_VL_12B` | for AI features | Never referenced from client code |
| `NVIDIA_API_KEY_LLAMA_NEMOTRON_VL_8B` | for AI features | Never referenced from client code |
| `NVIDIA_API_KEY_NEMOTRON_9B` | for AI features | Never referenced from client code |
| `LOG_LEVEL` | — | Defaults to `debug` outside production, `info` in production |

Validation happens at import time (`src/lib/env.ts`, via Zod) — a missing
required variable throws immediately in `development`/`production`. During
`next build`'s static-analysis pass and in tests, validation is relaxed so
the module graph can still load (see comments in `env.ts`).

## Database migrations

Schema lives in `src/db/schema.ts` (Drizzle). To change it:

```bash
# 1. Edit src/db/schema.ts
# 2. Generate a new migration:
npm run db:generate
# -> writes drizzle/000N_*.sql + updates drizzle/meta/_journal.json

# 3. Review the generated SQL, then apply it:
npm run db:migrate
```

Commit both the generated `.sql` file and `drizzle/meta/` — the journal is
how `drizzle-kit migrate` tracks what's already been applied. The initial
migration (`drizzle/0000_*.sql`) in this repo was generated this way and its
column/index/FK counts were inspected before being committed — see
`docs/ARCHITECTURE.md` for why Drizzle was chosen over Prisma here.

## Redis setup

Redis is optional and the app **fails safe** without it — see
`src/lib/redis.ts` and `src/lib/rateLimit.ts`. When `REDIS_URL` is set, it's
used for:

- Rate-limit counters (`auth:google:initiate`, `auth:google:callback`,
  `auth:refresh`, `ai:<capability>`)
- A ready-made `takeOnce()` helper for one-time-use tokens, available for
  future modules that need it

It is **not** used to store OAuth `state`/`nonce`/PKCE `verifier` today —
those live in short-lived (10-minute) HttpOnly cookies instead, which keeps
the OAuth handshake correct on stateless/serverless deployments without
requiring Redis to be provisioned before sign-in works at all. Postgres
remains the sole source of truth for persistent identity and session state
in all cases.
