# Title
Concurrency P2 hardening: full-flow session create race + poller multi-instance locks

# What changed
- Replaced `/playbook/full-flow` ticket session check-then-insert with atomic resolve/create using DB transaction + `pg_advisory_xact_lock`.
- Added `withTryAdvisoryLock(...)` helper in API DB module for session-level advisory locks.
- Wrapped Autotask and Email ingestion poll cycles with DB advisory locks to coordinate across multiple API instances.
- Kept local `isPolling` flags as intra-process reentrancy guards.

# Why it changed
To close two remaining P2 race conditions from the concurrency audit:
- duplicate triage session auto-creation under concurrent `/playbook/full-flow` requests,
- duplicate polling work when multiple API replicas run pollers simultaneously.

# Impact (UI / logic / data)
- UI: none.
- Logic: safer cluster behavior for pollers and ticket-driven `/playbook/full-flow` initialization.
- Data: none (no new migration for this change).

# Files touched
- `apps/api/src/routes/playbook.ts`
- `apps/api/src/services/autotask-polling.ts`
- `apps/api/src/services/email-ingestion-polling.ts`
- `apps/api/src/db/index.ts`

# Date
2026-02-24
