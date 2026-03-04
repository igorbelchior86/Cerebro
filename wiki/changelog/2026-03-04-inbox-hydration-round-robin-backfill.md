# Inbox Hydration Fairness Fix (System-wide Unknown fields)
# What changed
- Reworked workflow inbox read-path hydration candidate selection to avoid starvation on large backlogs.
- `hydrateMissingOrgRequester` now computes all incomplete candidates first, then picks a round-robin batch per tenant instead of always slicing from the head.
- Added tenant-scoped in-memory hydration cursor (`inboxHydrationCursorByTenant`) to ensure progressive coverage across calls.
- Added regression test proving hydration reaches tickets outside the first failing subset.

# Why it changed
- With thousands of tickets, repeated timeouts/failures on the first candidate subset could cause endless retries on the same tickets.
- That made many cards remain `Unknown org/requester` until opening an individual ticket triggered a different enrichment path.

# Impact (UI / logic / data)
- UI: sidebar cards progressively hydrate across the whole list without manual per-ticket open.
- Logic: hydration batch selection now guarantees fairness/progress under partial failure conditions.
- Data: no schema changes.

# Files touched
- `apps/api/src/services/orchestration/ticket-workflow-core.ts`
- `apps/api/src/__tests__/services/ticket-workflow-core.test.ts`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-04
