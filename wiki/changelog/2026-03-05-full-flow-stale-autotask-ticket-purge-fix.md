# Full-Flow Stale Autotask Ticket Purge Fix

# What changed
- Added stale-ticket detection to the playbook full-flow route when background processing reports that the Autotask ticket no longer exists.
- Purged the corresponding workflow inbox row through `workflowService.removeInboxTicket(...)`.
- Marked the related `triage_session` as terminal with `status='failed'`, clearing retries and storing the upstream deletion reason in `last_error`.
- Added route-level regression tests for missing-ticket detection and purge behavior.

# Why it changed
- The system was already receiving a reliable `ticket not found` signal from Autotask during `prepare_context`, but that signal was not being converted into a local terminal state.
- As a result, deleted PSA tickets could remain stale in Cerebro indefinitely until a separate parity pass happened to remove them.

# Impact (UI / logic / data)
- UI: deleted PSA tickets stop appearing in the workflow inbox after the first useful full-flow `not found`.
- Logic: the full-flow route now distinguishes upstream deletion from transient provider errors.
- Data: confirmed missing upstream tickets are purged from the inbox read model tenant-scoped, and their `triage_sessions` rows are moved to a no-retry terminal state with deletion provenance in `last_error`.

# Files touched
- `apps/api/src/services/application/route-handlers/playbook-route-handlers.ts`
- `apps/api/src/__tests__/routes/playbook.full-flow-stale-ticket.test.ts`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-05
