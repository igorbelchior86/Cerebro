# Title
Autotask active parity now excludes Complete queue explicitly

# What changed
- Added queue-scope resolution in `AutotaskPollingService` to identify excluded queue IDs by queue name.
- Added `AUTOTASK_PARITY_ACTIVE_EXCLUDED_QUEUES` config (default: `complete`).
- Applied exclusion to both active parity paths:
  - queue snapshot ingestion
  - recent polling ingestion (`createDate > now - 1h`)
- Added regression test validating that tickets in `Complete` queue are skipped in both paths.

# Why it changed
- Active parity requirement was clarified: include everything that is not in queue `Complete`.
- Previous implementation of active-only removed historical backfill, but did not explicitly exclude `Complete` queue tickets from ingestion logic.

# Impact (UI / logic / data)
- UI: sidebar/queue parity now reflects active queues more accurately by excluding completed-queue tickets.
- Logic: active parity is now explicit queue-based filtering, not only source-based ingestion.
- Data: reduced ingestion of finalized tickets from `Complete` queue into active operational view.

# Files touched
- `apps/api/src/services/adapters/autotask-polling.ts`
- `apps/api/src/__tests__/services/autotask-polling.test.ts`
- `tasks/todo.md`

# Date
2026-03-03
