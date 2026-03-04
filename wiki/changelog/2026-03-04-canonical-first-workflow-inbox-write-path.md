# Canonical-First Workflow Inbox Write Path
# What changed
- Updated `processAutotaskSyncEvent` in the orchestration workflow core to canonicalize inbox fields before persistence.
- Added conditional Autotask snapshot enrichment on sync write when payload is partial or non-canonical (`org/requester/created_at/status label` missing, or numeric status code only).
- Replaced direct payload-first assignment with meaningful canonical selection for `company`, `requester`, `status`, `assigned_to`, `queue_id`, `queue_name`, and `created_at`.
- Added regression test: partial poller sync payload now persists canonical values in inbox immediately.

# Why it changed
- Sidebar cards were still showing wrong fallback values (`Unknown org/requester`, wrong status text/time) because incomplete poller payload was materialized as-is and only corrected later by read-time hydration.
- This created visible race conditions and unstable card values.

# Impact (UI / logic / data)
- UI: cards converge with canonical values earlier, reducing fallback flicker/race behavior.
- Logic: canonical enrichment moved to write-path for sync events, not only read-path hydration.
- Data: inbox read-model stores canonicalized ticket metadata at ingestion time.

# Files touched
- `apps/api/src/services/orchestration/ticket-workflow-core.ts`
- `apps/api/src/__tests__/services/ticket-workflow-core.test.ts`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-04
