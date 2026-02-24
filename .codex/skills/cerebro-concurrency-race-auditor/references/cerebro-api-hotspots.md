# Cerebro API Concurrency Hotspots

Use this file before auditing to avoid generic reviews. These are the highest-value concurrency targets in this repo as of 2026-02-24.

## Priority 1

### `apps/api/src/services/triage-orchestrator.ts`

- Starts a retry listener (`setInterval`) and also runs work immediately on startup.
- Reads existing `triage_sessions`, then updates status across multiple statements.
- Can race with:
  - Manual reruns from routes
  - Pollers triggering the same ticket
  - Another API instance doing the same retry sweep
- Audit for:
  - compare-and-set status updates
  - duplicate session creation
  - duplicate playbook writes
  - stale `processing` recovery collisions

### `apps/api/src/routes/playbook.ts` (background processing helper)

- Launches background step completion logic and conditionally writes `llm_outputs`, `validation_results`, and playbook artifacts.
- Can overlap with orchestrator pipeline for the same session.
- Audit for:
  - duplicate inserts vs update paths
  - missing idempotency keys / unique constraints
  - inconsistent “latest row” semantics (`ORDER BY created_at DESC LIMIT 1`)

## Priority 2

### `apps/api/src/services/autotask-polling.ts`

- Uses local in-memory `isPolling` to avoid overlap.
- Guard works only within one process; does not protect multi-instance deployments.
- Calls `triageOrchestrator.runPipeline(...)` repeatedly.
- Audit for duplicate ticket triggering and downstream idempotency assumptions.

### `apps/api/src/services/email-ingestion-polling.ts`

- Uses local `isPolling` with timer loop.
- Performs both mailbox ingestion and pending-ticket backfill in one poll cycle.
- Audit for long-running cycle overlap, starvation, and duplicate backfill under multiple instances.

## Priority 3

### `apps/api/src/lib/tenantContext.ts` + `apps/api/src/db/pool.ts`

- Uses `AsyncLocalStorage` for tenant/RLS context.
- Audit async boundaries that may lose or override tenant context during background work or nested `run(...)`.
- Confirm transaction wrapper sets RLS context correctly for all code paths.

### `apps/api/src/services/cache.ts`

- In-memory singleton cache with mutable `Map`.
- Low risk for thread races (single process), but still audit for:
  - stale reads under concurrent requests
  - cache stampede / duplicate recomputation
  - shared prefix instance behavior

## Evidence To Capture

- Before/after DB rows for the affected session/ticket
- Exact interleaving (Request A, Poller B, Retry Listener C)
- Duplicate rows or overwritten payloads
- Logs with timestamps and session IDs
- Whether behavior reproduces on single instance vs multi-instance

