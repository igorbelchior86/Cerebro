# Title
Concurrency hardening: orchestrator claim/retry atomicity + full-flow UPSERT idempotency

# What changed
- Added DB transaction helper and row-count `execute(...)` return in API DB module.
- Serialized orchestrator session claim/create per ticket using PostgreSQL advisory transaction lock.
- Prevented overlapping retry sweeps in one process with `isRetrySweepRunning`.
- Made `retry_count` increment/backoff write atomic with row lock.
- Replaced manual background `SELECT -> UPDATE/INSERT` artifact writes with UPSERTs in:
  - `triage-orchestrator`
  - `/playbook/full-flow` background processing
- Added migration to dedupe artifact duplicates and create unique indexes used by UPSERT.
- Updated `init.sql` to include the same unique indexes for fresh databases.

# Why it changed
To address race conditions identified in the concurrency audit (duplicate work, stale overwrites, and lost updates) without changing the user-facing flow.

# Impact (UI / logic / data)
- UI: none.
- Logic: safer multi-request/poller/retry behavior; reduced duplicate processing and overwrite races.
- Data: duplicate artifact rows are compacted to latest entries during migration; uniqueness enforced going forward.

# Files touched
- `apps/api/src/db/index.ts`
- `apps/api/src/services/triage-orchestrator.ts`
- `apps/api/src/routes/playbook.ts`
- `apps/api/src/db/migrations/014_concurrency_idempotency_indexes.sql`
- `init.sql`

# Date
2026-02-24
