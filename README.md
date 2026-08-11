# IntelliHire

**AI-Based Placement Trainer.** Train smart. Perform better. Get placed.

This repository contains IntelliHire's authentication foundation: Google
OAuth 2.0 + OpenID Connect sign-in, server-managed sessions, role/permission
guards, and a reusable NVIDIA AI provider abstraction that every future
IntelliHire module (resume screening, adaptive assessments, technical/HR
interviews, insights) builds on.

## Stack

| Concern        | Choice                                   |
| -------------- | ----------------------------------------- |
| Framework      | Next.js 16 (App Router, TypeScript strict) |
| Database       | PostgreSQL via Drizzle ORM                 |
| Cache          | Redis (optional, fails safe if absent)     |
| Auth           | Google OAuth 2.0 + OIDC, PKCE, server sessions |
| AI provider    | NVIDIA NIM, capability-based abstraction   |
| Tests          | Vitest                                     |

Drizzle (not Prisma) was chosen deliberately: it has no native binary engine
to download, which keeps `generate`/`typecheck`/CI fast and dependency-light.

## Quickstart

```bash
cp .env.example .env.local        # fill in real values — see docs/GOOGLE_OAUTH_SETUP.md
docker compose up -d              # local Postgres + Redis
npm install
npm run db:migrate                # apply drizzle/*.sql to the database
npm run dev                       # http://localhost:3000
```

## Scripts

| Command              | Purpose                                  |
| --------------------- | ----------------------------------------- |
| `npm run dev`         | Local dev server                          |
| `npm run build`       | Production build                          |
| `npm run lint`        | ESLint                                    |
| `npm run typecheck`   | `tsc --noEmit`                            |
| `npm test`            | Vitest, single run                        |
| `npm run test:watch`  | Vitest, watch mode                        |
| `npm run db:generate` | Generate a new SQL migration from `src/db/schema.ts` |
| `npm run db:migrate`  | Apply pending migrations to `DATABASE_URL` |

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system diagram, request flow, session model
- [docs/GOOGLE_OAUTH_SETUP.md](docs/GOOGLE_OAUTH_SETUP.md) — Google Cloud Console setup, redirect URIs
- [docs/AUTHORIZATION.md](docs/AUTHORIZATION.md) — roles, permissions, guards
- [docs/AI_PROVIDER.md](docs/AI_PROVIDER.md) — NVIDIA provider architecture, adding a new module
- [docs/TESTING.md](docs/TESTING.md) — what's covered, what isn't, and why
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — **read this before deploying — GitHub Pages will not work for this app**
- [docs/SECURITY.md](docs/SECURITY.md) — threat model and mitigations

## A note on the entry page

The entry page (`src/app/page.tsx`) is a single "Continue with Google" CTA —
no email/password, username/password, phone, OTP, or magic-link auth exists
anywhere in this codebase, by design.
