# IntelliHire v8

**AI-Based Placement Trainer.** Train smart. Perform better. Get placed.

## Deployment

- **Application:** Vercel — server-capable hosting for the Next.js application.
- **Static surface:** GitHub Pages — static project/documentation landing page.
- **CI/CD:** GitHub Actions — CI, Pages deployment, and optional Vercel production deployment.

GitHub Pages cannot host the complete application because the full IntelliHire architecture requires server-side Next.js routes, PostgreSQL, session cookies, and OAuth callbacks.

## Local development

```bash
npm install
npm run dev
```

See `.env.example` and `docs/DEPLOYMENT.md` for production configuration.
