# API Failure Pending Retry Queue
# What changed
- Transient provider/API errors now set session status to `pending` (retry queue) instead of `blocked`.
- Updated both orchestrator pipeline catch path and `full-flow` background catch path.
- Added broader transient error matching for common provider/network/auth failures.

# Why it changed
- Ensure API instability does not terminalize tickets as failed/blocked.

# Impact (UI / logic / data)
- UI: fewer blocked/failed artifacts from temporary outages.
- Logic: automatic retry loop can continue from `pending` status.
- Data: unchanged.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/triage-orchestrator.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/playbook.ts
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/features/api-failure-pending-retry-queue.md

# Date
- 2026-02-21
