# Full Flow Rate Limit Backoff Cooldown
# What changed
- Added persistent retry backoff handling to `GET /playbook/full-flow` background processing for transient provider/quota errors.
- `/playbook/full-flow` now stores `retry_count` and `next_retry_at` on transient failures instead of only setting status to `pending`.
- `/playbook/full-flow` now skips background retriggers while `next_retry_at` cooldown is still active.
- Successful completion now clears retry metadata (`retry_count`, `next_retry_at`, `last_error`), and non-transient failures clear retry scheduling.

# Why it changed
- The route had a parallel background-processing path that retried immediately on every UI poll after a transient quota/rate-limit error.
- This could amplify free-tier API exhaustion and produce repeated `pending/failed` churn even though the provider limiter already existed.

# Impact (UI / logic / data)
- UI: Polling `/playbook/full-flow` will no longer repeatedly retrigger LLM work during a backoff window.
- Logic: Route-level transient errors now use exponential backoff persisted in `triage_sessions`, aligned with orchestrator behavior.
- Data: `triage_sessions.retry_count` and `triage_sessions.next_retry_at` are now updated by `/playbook/full-flow` transient error handling.

# Files touched
- `apps/api/src/routes/playbook.ts`

# Date
- 2026-02-24

