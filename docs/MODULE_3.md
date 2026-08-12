# Module 3 — Technical Interview

Module 3 is the authenticated technical-interview workflow in IntelliHire. It reuses the existing Google/OIDC session, PostgreSQL connection, AI service abstraction, validation, logging, and Next.js App Router.

## Workflow

1. `POST /api/technical/start` creates or resumes the authenticated user's in-progress interview.
2. Four persisted questions cover technical reasoning, DSA, system design, and project trade-offs.
3. `POST /api/technical/answer` validates ownership and question membership, evaluates the answer through the server-side AI abstraction, validates the structured output, and persists the response.
4. If the external AI provider is unavailable or returns malformed output, a deterministic coaching fallback is used so the interview remains completable.
5. The final report can only be generated after every question has an evaluated response.
6. `POST /api/technical/complete` persists the aggregate result transactionally and marks the interview completed.
7. `GET /api/technical/history` returns the authenticated user's recent interview history.

## Security

All Module 3 APIs call `getCurrentAuth()` server-side and scope every database read/write by the authenticated user ID. Interview IDs and question IDs are validated as UUIDs. Answer and code payloads have hard limits. Server errors do not expose stack traces, credentials, or provider secrets.

Submitted code is stored for review only and is never executed by the application.

## AI

Module 3 calls `aiService.generate()` rather than a provider directly. The existing provider selection and AI usage budget therefore remain centralized. AI output is parsed and validated with Zod before persistence or scoring. AI output is coaching feedback and is not used as an autonomous hiring decision.

## Persistence

The current repository creates the Module 3 tables defensively on first use so deployments that predate Module 3 can recover without a manual table-creation step. The tables use foreign keys, unique constraints, and indexes for user/status, interview/question ordering, response lookup, and result uniqueness.

## Verification

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The dedicated evaluator tests cover structured-output parsing, malformed output rejection, score bounds, and deterministic fallback behavior.
