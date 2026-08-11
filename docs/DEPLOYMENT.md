# Production Deployment

## GitHub Pages will not work for this app — read this first

GitHub Pages serves **static files only**. This app requires, on every
request: a running Node server, a live PostgreSQL connection, HttpOnly
cookie handling, and (for `/api/auth/google/callback`) the ability to
execute server-side code to verify a Google ID token and write to a
database. None of that can run on Pages. If GitHub Pages is a hard
requirement for some *other* static asset of this project, the realistic
split is:

- Static marketing/docs pages → GitHub Pages
- Everything under `src/app/(auth entry, dashboard, api/**)` → a Node-capable
  host

Deploying the actual application needs a platform that runs Node
server-side. In rough order of fit for this Next.js App Router codebase:

| Platform | Fit |
| --- | --- |
| **Vercel** | Built by the Next.js maintainers; zero-config for App Router + API routes; easiest place to set the required env vars as secrets |
| Render / Railway / Fly.io | General-purpose Node hosting; works fine, more manual setup (Dockerfile or build command, managed Postgres/Redis add-ons) |
| Self-hosted (Docker + your own Postgres/Redis) | `next build && next start`, fronted by your own reverse proxy/TLS |

## Deploying to Vercel

1. Import the GitHub repo in the Vercel dashboard (or `vercel link` +
   `vercel deploy` from this directory).
2. Add every variable from `.env.example` as a **Project → Settings →
   Environment Variables** entry, for each environment (Preview /
   Production) that needs it. Use real values — `GOOGLE_CLIENT_SECRET`,
   `SESSION_SECRET`, and the `NVIDIA_API_KEY_*` values are real secrets and
   must never be committed.
3. Provision Postgres (Vercel Postgres, Neon, Supabase, RDS — any
   standard Postgres works) and set `DATABASE_URL`.
4. Provision Redis if you want it (Upstash is a common Vercel-friendly
   choice) and set `REDIS_URL`. Optional — the app degrades gracefully
   without it (see `docs/ARCHITECTURE.md`).
5. Add the deployed domain's origin and
   `https://<your-domain>/api/auth/google/callback` to the Google Cloud
   OAuth client (`docs/GOOGLE_OAUTH_SETUP.md`, steps 2–3), and set
   `GOOGLE_REDIRECT_URI`/`APP_URL` to match.
6. Run migrations against the production database once, from CI or
   locally with production `DATABASE_URL`: `npm run db:migrate`.
7. Deploy. Confirm `GET /api/health` returns `{"status":"healthy"}`.

## GitHub Actions

`.github/workflows/ci.yml` runs lint/typecheck/test/build on every push and
PR, using placeholder env vars for the build step (a `next build` needs the
env schema to validate, but doesn't need real secrets — see
`src/lib/env.ts`'s build-phase relaxation). It does **not** deploy anywhere;
wire a deploy step (`vercel deploy --prod` with a `VERCEL_TOKEN` secret, or
your chosen platform's CLI/action) once you've picked a target and
provisioned real infrastructure, since that requires secrets and
infrastructure this repository can't create on your behalf.

## Health checks

`GET /api/health` checks Postgres connectivity (`SELECT 1`) and reports
whether Redis is configured; returns `503` if Postgres is unreachable. Point
your platform's readiness probe at this endpoint.
