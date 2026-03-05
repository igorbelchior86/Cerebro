# Title
P2 concurrency fixes: atomic `/playbook/full-flow` session auto-create and distributed poller locks

# What changed
- `/playbook/full-flow` session resolution for ticket IDs now uses a DB transaction plus PostgreSQL transaction-scoped advisory lock (`pg_advisory_xact_lock`) to serialize concurrent requests per ticket.
- Added a reusable DB helper `withTryAdvisoryLock(...)` for session-level advisory locks around long-running work.
- `AutotaskPollingService` and `TicketIntakePollingService` now acquire a DB-backed advisory lock before each polling cycle.
- Existing local `isPolling` guards were preserved as same-process overlap protection.

# Why it changed
Two remaining concurrency risks from the audit were still open:
- concurrent `/playbook/full-flow` requests could both decide “no session exists” and insert duplicate sessions for the same ticket;
- pollers used only local memory flags, which do not coordinate multiple API instances.

# Impact (UI / logic / data)
- UI: no direct change.
- Logic: duplicate session creation risk for `/playbook/full-flow` ticket IDs is reduced; pollers now avoid duplicate cross-instance polling cycles.
- Data: no schema changes in this fix; uses Postgres advisory locks only.

# Files touched
- `apps/api/src/routes/playbook.ts`
- `apps/api/src/services/autotask-polling.ts`
- `apps/api/src/services/ticket-intake-polling.ts`
- `apps/api/src/db/index.ts`

# Date
2026-02-24
