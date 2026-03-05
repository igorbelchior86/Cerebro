# Workflow Inbox Terminal Status Mirror Fix
# What changed
- Removed the active-set purge path that was deleting inbox rows when Autotask still returned the ticket as `Complete`.
- Updated the Autotask parity purge to sync terminal status back into the canonical inbox row instead of removing the ticket.
- Stopped `TicketWorkflowCoreService.buildInboxListView()` from filtering terminal statuses out of the inbox projection.
- Changed terminal-status parity scanning to round-robin across the inbox per tenant, so stale rows outside the first bounded batch are revisited automatically.
- Added regressions covering terminal status projection in both the poller and workflow core.

# Why it changed
- The product requirement was clarified: the workflow inbox must mirror the PSA, not hide or delete `Complete` tickets.
- The prior implementation treated `Complete` as ineligible for the inbox and therefore masked the real problem: stale status propagation from Autotask into the inbox read model.
- After the first fix, convergence still was not fully automatic because the bounded purge/reconcile logic only checked the first `N` inbox rows per run. Tickets outside that slice could remain stale unless manually reconciled.

# Impact (UI / logic / data)
- UI: queue cards can now keep showing tickets after they reach `Complete`, with the correct status instead of disappearing.
- Logic: parity reconciliation now updates terminal status via canonical sync events, rotates the bounded check window fairly across inbox rows, and keeps purge only for true upstream deletions (`not found`).
- Data: existing inbox rows retain their identity/history while receiving updated terminal status labels from Autotask.

# Files touched
- `apps/api/src/services/adapters/autotask-polling.ts`
- `apps/api/src/services/orchestration/ticket-workflow-core.ts`
- `apps/api/src/__tests__/services/autotask-polling.test.ts`
- `apps/api/src/__tests__/services/ticket-workflow-core.test.ts`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-05
