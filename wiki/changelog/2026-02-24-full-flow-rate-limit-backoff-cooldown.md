# Changelog: Full Flow Rate Limit Backoff Cooldown
# What changed
- Fixed `/playbook/full-flow` background processing to persist retry backoff (`retry_count`, `next_retry_at`) on transient provider/quota errors.
- Added cooldown check so the route does not retrigger background processing before `next_retry_at`.
- Cleared retry metadata on success (`approved`) and non-transient `failed` updates.

# Why it changed
- UI polling could retrigger LLM-heavy background work immediately after `429/quota` errors, accelerating free-tier quota exhaustion and increasing `FAILED`/retry churn.

# Impact (UI / logic / data)
- UI: Repeated polling is less likely to hammer the provider during quota cooldown windows.
- Logic: Route behavior is now closer to `triage-orchestrator` retry semantics for transient provider failures.
- Data: `triage_sessions` retry scheduling fields are used consistently by `/playbook/full-flow`.

# Files touched
- `apps/api/src/routes/playbook.ts`
- `wiki/features/full-flow-rate-limit-backoff-cooldown.md`

# Date
- 2026-02-24

