# Production Deployment

GitHub Pages is the static surface; the complete IntelliHire Next.js application belongs on Vercel or another Node-capable host because it requires server routes, OAuth callbacks, PostgreSQL, and HttpOnly sessions.

GitHub Actions included:

- `ci.yml` — validation/build on pushes and pull requests.
- `pages.yml` — publishes `docs-site/` to GitHub Pages.
- `vercel.yml` — deploys `master-branch` to Vercel when the repository secret `VERCEL_TOKEN` is configured.

Production also needs the variables in `.env.example` and a provisioned PostgreSQL database. Run `npm run db:migrate` against the production database before enabling authenticated flows.
