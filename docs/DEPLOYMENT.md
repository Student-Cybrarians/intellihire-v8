# Production Deployment

## Hosting split

GitHub Pages serves static files only. The complete IntelliHire Next.js application requires a Node-capable runtime for API routes, OAuth callbacks, PostgreSQL access, and HttpOnly session cookies.

- **Vercel:** full Next.js application.
- **GitHub Pages:** static project/documentation surface.
- **GitHub Actions:** CI and optional Vercel production deployment.

## GitHub Actions

- `.github/workflows/ci.yml` validates the project on pushes and pull requests.
- `.github/workflows/pages.yml` publishes `docs-site/` to GitHub Pages.
- `.github/workflows/vercel.yml` deploys `master-branch` to Vercel when `VERCEL_TOKEN` is configured as a repository secret.

## Required production infrastructure

Configure the application environment variables from `.env.example`, including PostgreSQL, Google OAuth, session secret, and optional Redis/NVIDIA credentials. Run `npm run db:migrate` against the production database before using authenticated features.
