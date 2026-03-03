# Title
Autotask parity queue snapshot fail-open hardening

# What changed
- Added fail-open protection around queue snapshot execution in `AutotaskPollingService.runOnce()`.
- Added capability guard in `runQueueParitySnapshot()` to skip snapshot when `client.getTicketQueues` is unavailable.
- Preserved main polling flow (`searchTickets` ingestion + triage dispatch) even if queue snapshot fails.

# Why it changed
- Queue snapshot parity was aborting the full poll cycle in degraded/mock contexts where `getTicketQueues` is not implemented, causing ticket parity drift and regressions in sync behavior.

# Impact (UI / logic / data)
- UI: indirect improvement via more stable ticket freshness/parity in inbox sidebar.
- Logic: poller now isolates snapshot errors and continues primary ingestion path.
- Data: reduces risk of stale or missing tickets caused by interrupted poll runs.

# Files touched
- `apps/api/src/services/adapters/autotask-polling.ts`
- `tasks/todo.md`

# Date
2026-03-03
