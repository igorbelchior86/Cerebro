# Inbox Placeholder Hydration Systemic Fix
# What changed
- Updated workflow inbox hydration eligibility to treat placeholder values as missing data.
- Added `needsInboxHydration` with sentinel handling for `company`, `requester`, `status`, `assigned_to`, and invalid `created_at`.
- Updated remote snapshot merge to prefer meaningful values and ignore placeholder strings.
- Added regression test proving rows with `Unknown org/requester` are rehydrated from Autotask snapshot.

# Why it changed
- System-wide cards remained with fallback labels unless the ticket was opened individually.
- Root cause was that placeholder strings were considered valid non-empty data, so the backfill pipeline skipped those rows.

# Impact (UI / logic / data)
- UI: Sidebar cards hydrate canonical org/requester/status/assignee without requiring per-ticket open.
- Logic: Inbox hydration now covers both empty and placeholder-based missing fields.
- Data: No schema or migration changes.

# Files touched
- `apps/api/src/services/orchestration/ticket-workflow-core.ts`
- `apps/api/src/__tests__/services/ticket-workflow-core.test.ts`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-04
