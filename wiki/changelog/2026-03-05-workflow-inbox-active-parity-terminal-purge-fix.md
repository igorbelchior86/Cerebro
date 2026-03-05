# Workflow Inbox Active Parity Terminal Purge Fix

# What changed
- The workflow inbox projection now excludes tickets whose effective local status is terminal (`Complete`, `Closed`, `Resolved`, `Done`).
- The Autotask parity purge now removes inbox rows when the remote ticket still exists but is already in a terminal status, not only when the ticket is missing upstream.
- Regression tests were added for both behaviors.

# Why it changed
- Live validation showed a parity drift between Cerebro and Autotask active tickets.
- The inbox showed tickets as active even after Autotask had already transitioned them to `Complete`.
- The purge path incorrectly modeled only remote deletion, not removal from the active ticket set.

# Impact (UI / logic / data)
- UI: the global queue count no longer includes tickets that are terminal upstream or already terminal in the local projection.
- Logic: the active inbox read model is now aligned with the Autotask rule `status != Complete` for active-ticket parity.
- Data: terminal inbox rows are removed during parity purge and filtered out from local list projection.

# Files touched
- `apps/api/src/services/orchestration/ticket-workflow-core.ts`
- `apps/api/src/services/adapters/autotask-polling.ts`
- `apps/api/src/__tests__/services/ticket-workflow-core.test.ts`
- `apps/api/src/__tests__/services/autotask-polling.test.ts`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-05
