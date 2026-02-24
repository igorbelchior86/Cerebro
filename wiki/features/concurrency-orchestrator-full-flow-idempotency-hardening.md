# Title
Concurrency hardening for triage orchestrator and `/playbook/full-flow` background pipeline

# What changed
- Added `transaction(...)` helper in API DB layer (`apps/api/src/db/index.ts`) for atomic multi-statement operations.
- Hardened `TriageOrchestrator` session claim/create using transaction-scoped PostgreSQL advisory lock + row lock on the latest session row.
- Added local retry-sweep overlap guard (`isRetrySweepRunning`) to avoid same-process interval reentrancy.
- Made retry backoff counter update atomic (`SELECT ... FOR UPDATE` + update in one transaction).
- Converted artifact persistence in `triage-orchestrator` and `/playbook/full-flow` background processing from manual check-then-act (`SELECT` then `UPDATE/INSERT`) to UPSERT (`INSERT ... ON CONFLICT DO UPDATE`).
- Added migration to deduplicate existing duplicates and enforce unique indexes for artifact idempotency keys.

# Why it changed
The previous implementation allowed race conditions under concurrent requests, retries, pollers, or multiple API instances:
- duplicate session creation/claiming for the same ticket,
- overlapping retry sweeps,
- duplicate or stale artifact writes in `llm_outputs`, `validation_results`, and `playbooks`,
- lost increments in `retry_count`.

# Impact (UI / logic / data)
- UI: no direct UI change.
- Logic: stronger concurrency guarantees for orchestrator retries and full-flow background generation; duplicate work is reduced and same logical artifact keys are updated deterministically.
- Data: migration removes duplicate artifact rows (keeping the most recent per logical key) and adds unique indexes:
  - `llm_outputs(session_id, step)`
  - `validation_results(session_id)`
  - `playbooks(session_id)`

# Files touched
- `apps/api/src/db/index.ts`
- `apps/api/src/services/triage-orchestrator.ts`
- `apps/api/src/routes/playbook.ts`
- `apps/api/src/db/migrations/014_concurrency_idempotency_indexes.sql`
- `init.sql`

# Date
2026-02-24
