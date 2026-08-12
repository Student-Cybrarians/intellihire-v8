# Module 2 — Adaptive Assessment

Module 2 is the authenticated adaptive assessment workflow at `/dashboard/module-2`.

## Flow

```text
Browser
  -> POST /api/assessments/start
  -> PostgreSQL assessment_attempts
  -> adaptive question selection
  -> POST /api/assessments/answer (one answer at a time)
  -> transactional response + ability update
  -> repeat until 8 answers
  -> POST /api/assessments/complete
  -> deterministic scoring
  -> optional AI coaching enrichment
  -> PostgreSQL assessment_results
  -> report UI
```

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/assessments/start` | Session | Create or resume the current user's in-progress attempt. |
| GET | `/api/assessments/state?attemptId=<uuid>` | Session | Retrieve an attempt owned by the current user. |
| POST | `/api/assessments/answer` | Session | Validate and transactionally persist an answer. |
| POST | `/api/assessments/complete` | Session | Finalize exactly eight answers and persist the report. |

All IDs are UUIDs and ownership is checked server-side. The frontend cannot select another user's attempt.

## Adaptive engine

The question selector targets the current ability estimate. Each answer updates ability using a bounded 3PL-style calculation. The public score is mapped to a 0–100 scale.

## AI coaching

AI is never used to determine correctness or scores. Scores are calculated deterministically from persisted responses. After completion, the server may ask the configured AI provider for structured coaching feedback. The response is validated with Zod before it can replace the deterministic fallback feedback.

NVIDIA is preferred when `NVIDIA_API_KEY` is configured:

- `NVIDIA_API_KEY`
- `NVIDIA_API_BASE_URL=https://integrate.api.nvidia.com/v1/chat/completions`
- `NVIDIA_MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`

OpenRouter remains supported as a fallback provider.

## Failure behavior

- Missing/invalid session: `401`.
- Invalid request: `400`.
- Invalid answer choice: rejected server-side.
- Duplicate answer: rejected by application and database uniqueness constraint.
- More than eight answers: rejected.
- Completion before eight answers: rejected.
- AI timeout/provider failure: deterministic assessment result remains available.
- Refresh during an active attempt: the server resumes the user's existing in-progress attempt.

## Security

AI credentials remain server-side. Attempt IDs are scoped to the authenticated user. Input sizes and answer indexes are validated before database operations. Database writes for an answer use a transaction and row lock.

## Testing

CI runs dependency installation, lint, TypeScript typechecking, Vitest, and the production build against PostgreSQL. The adaptive engine has unit coverage for probability bounds, ability direction, score mapping, and question selection.
