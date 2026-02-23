# API Failure Pending Retry Queue
# What changed
- Changed transient API/provider failure handling in the orchestrator from `blocked` to `pending`.
- Changed transient background full-flow failure handling from `blocked` to `pending`.
- Expanded transient-failure detection to include network/provider/auth-related error signatures (429/rate-limit/timeouts/network errors/api key/access denied).

# Why it changed
- Requirement: API failures must be queued for retry, not terminalized as `failed`/`blocked`.
- This keeps tickets in retry-eligible state and prevents mass terminal statuses due to provider instability.

# Impact (UI / logic / data)
- UI: tickets affected by transient API issues appear as retryable pending instead of blocked/failed.
- Logic: retry queue semantics now use `pending` as the transient error sink.
- Data: no schema change.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/triage-orchestrator.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/playbook.ts

# Date
- 2026-02-21
