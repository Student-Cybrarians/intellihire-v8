# Module 5 — Performance Insights

Module 5 is the user-facing readiness and analytics layer for IntelliHire. It aggregates completed results from Modules 2–4 without duplicating their data.

## Workflow

1. Authenticate through the existing Google/OIDC server session.
2. Open `/dashboard/module-5`.
3. Select a 7/30/90/365-day window.
4. The server aggregates the authenticated user's assessment, technical interview, and HR interview results.
5. The UI presents an overall readiness score, module scorecard, completion evidence, trend, strengths, gaps, and recommendations.
6. A user may persist a point-in-time report and reopen it later.
7. CSV export is generated locally from the already-authorized response; no server-side file is created.

## Routes

- `GET /dashboard/module-5`
- `GET /dashboard/module-5/report/:id`
- `GET /api/insights/overview?days=30`
- `GET /api/insights/reports`
- `POST /api/insights/reports`
- `GET /api/insights/reports/:id`

All API routes require the existing active session. Report detail queries are scoped by both report ID and authenticated user ID, preventing cross-user access.

## Data model

`performance_insight_reports` stores snapshots only. Source-of-truth scores remain in the Module 2/3/4 result tables.

The migration is `drizzle/0004_performance_insights.sql` and is registered in `drizzle/meta/_journal.json`.

## Scoring

The overview score is the arithmetic mean of available completed module scores. Missing modules are not treated as zero. Readiness levels are:

- `NOT_STARTED`: no completed evidence
- `BUILDING`: 0–59
- `READY`: 60–79
- `STRONG`: 80–100

Recommendations are deterministic and explainable. Module 5 does not require an AI provider to remain usable.

## Security

- Existing `getCurrentAuth()` is the only identity source.
- No client-provided user ID is accepted.
- Report IDs are validated as UUIDs.
- Report queries include the authenticated user ID.
- Error responses do not expose SQL errors or stack traces.
- CSV export happens in the browser from authorized data already returned by the API.

## Current coverage

Module 1 ATS results are not currently included in the scorecard because the existing Module 1 flow does not persist ATS result records in the shared PostgreSQL schema. This is intentional rather than fabricating a score. Once Module 1 persistence is introduced, it can be added to the aggregation without changing the Module 5 API contract.
