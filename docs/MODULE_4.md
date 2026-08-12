# Module 4 — Real-Time HR Interview

Module 4 extends the shared IntelliHire authentication, PostgreSQL, API, AI provider abstraction, rate limiting, logging, and design system. It does not introduce a second identity system or database.

## Workflow

1. Authenticated user opens `/dashboard/module-4`.
2. User optionally supplies target role and company.
3. `POST /api/hr/start` creates or resumes one in-progress interview for that user.
4. The server creates five HR questions and persists interview state.
5. `POST /api/hr/answer` validates ownership, state, and answer length, evaluates the answer through the shared AI service, validates the returned JSON shape, and falls back to deterministic coaching if the provider is unavailable.
6. The next question is returned immediately.
7. `POST /api/hr/complete` requires every question to have an evaluation, aggregates the four coaching dimensions, persists the result, and marks the interview completed.
8. `GET /api/hr/history` returns the authenticated user's recent interviews.

## Frontend

- `/dashboard/module-4`
- Responsive interview workspace
- Loading, error, empty, progress, coaching, and result states
- Optional browser speech-to-text; no microphone audio is uploaded or stored by Module 4
- Keyboard-accessible native form controls

## API

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/hr/start` | Start or resume an interview |
| POST | `/api/hr/answer` | Submit and evaluate one answer |
| POST | `/api/hr/complete` | Finalize an interview |
| GET | `/api/hr/history` | List the current user's interviews |

All routes require the existing HttpOnly session and scope database operations by `auth.user.id` to prevent IDOR.

## Persistence

Migration `drizzle/0003_hr_interviews.sql` adds:

- `hr_interviews`
- `hr_questions`
- `hr_responses`
- `hr_results`

The migration is registered in the Drizzle journal. The repository also keeps a guarded schema bootstrap for compatibility with environments where the migration has not yet been applied; production deployments should run `npm run db:migrate` before serving traffic.

## AI

Module 4 calls `aiService`, never an AI provider from the browser. The existing provider selection is reused: NVIDIA is selected when `NVIDIA_API_KEY` is configured; otherwise OpenRouter is used. AI output is parsed and shape-checked. If AI is unavailable or returns malformed data, a deterministic coaching evaluator keeps the interview usable.

Set provider credentials only as server-side deployment secrets. Never add them to Git or `NEXT_PUBLIC_*` variables.

## Security

- Existing session authentication
- User-scoped resource queries
- Server-side interview state checks
- UUID validation
- Answer size limits
- Duplicate-answer protection
- No sensitive-trait inference in the evaluator prompt
- No raw tokens or API keys in logs

## Extension points

Module 5 can reuse the interview state/result patterns and the shared AI service without creating another user, session, database, or provider abstraction.
