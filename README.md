# IntelliHire

**AI-Based Placement Trainer.** Train smart. Perform better. Get placed.

IntelliHire is a Next.js App Router application with Google OAuth, server-managed PostgreSQL sessions, adaptive assessments, technical interviews, and an ATS screening module.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, TypeScript strict) |
| Database | PostgreSQL via Drizzle ORM |
| Cache | Redis (optional; in-memory fail-safe when absent) |
| Auth | Google OAuth 2.0 + OIDC, PKCE, server sessions |
| AI provider | OpenRouter via a capability-based `aiService` abstraction |
| Tests | Vitest |

Drizzle is used instead of Prisma to keep the application dependency-light and avoid a native query-engine download during migrations/builds.

## Quickstart

```bash
cp .env.example .env.local
npm install
npm run db:migrate
npm run dev
```

For a local PostgreSQL/Redis environment, `docker compose up -d` is available. See the deployment and OAuth documentation before configuring production credentials.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development server |
| `npm run build` | Apply pending Drizzle migrations, then create the production Next.js build |
| `npm run start` | Start the production Next.js server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Vitest single run |
| `npm run test:watch` | Vitest watch mode |
| `npm run db:generate` | Generate a Drizzle SQL migration |
| `npm run db:migrate` | Apply pending migrations to `DATABASE_URL` |

## Core application flows

- **Authentication:** Google OAuth callback verifies the ID token, creates/loads the user, creates a server-side session, and redirects to the requested protected page.
- **Module 1:** Resume + job description → AI ATS analysis when OpenRouter is available → deterministic ATS fallback when AI is unavailable.
- **Module 2:** Adaptive assessment with persisted attempts, answers, and final scoring.
- **Module 3:** Persisted technical interview sessions with answer evaluation and completion reporting.

## Environment variables

Production requires the values documented in `.env.example` and `docs/GOOGLE_OAUTH_SETUP.md`, including `DATABASE_URL`, `SESSION_SECRET`, Google OAuth credentials, and `OPENROUTER_API_KEY` for AI enrichment. Module 1 remains usable without the OpenRouter key because its deterministic ATS engine is the reliability fallback.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system diagram, request flow, session model
- [docs/GOOGLE_OAUTH_SETUP.md](docs/GOOGLE_OAUTH_SETUP.md) — Google Cloud Console setup and redirect URI
- [docs/AUTHORIZATION.md](docs/AUTHORIZATION.md) — roles, permissions, and guards
- [docs/AI_PROVIDER.md](docs/AI_PROVIDER.md) — OpenRouter provider architecture
- [docs/TESTING.md](docs/TESTING.md) — automated coverage and integration-test gaps
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Vercel deployment architecture
- [docs/SECURITY.md](docs/SECURITY.md) — threat model and mitigations

The entry page intentionally provides Google sign-in only; there is no email/password or magic-link authentication flow.
