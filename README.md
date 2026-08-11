# IntelliHire v8

**AI-Based Placement Trainer.** Train smart. Perform better. Get placed.

## Deployment

- **Application:** Vercel — the Next.js runtime is server-capable and supports the application architecture.
- **Static project surface:** GitHub Pages — used for the static landing/documentation surface only.
- **CI/CD:** GitHub Actions runs validation/builds and can deploy production to Vercel with the `VERCEL_TOKEN` repository secret.

> GitHub Pages cannot host the complete IntelliHire application because the full app requires server-side Next.js routes, PostgreSQL, session cookies, and OAuth callbacks.

## Local development

```bash
npm install
npm run dev
```

See the repository documentation for PostgreSQL, Redis, Google OAuth, NVIDIA AI, authorization, security, and production deployment configuration.
