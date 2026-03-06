# Recursive Concurrency Hunt: Persistence Guards and Poller Unref

# What changed
- `apps/api/src/services/context/persistence.ts`
  - `persistEvidencePack()` now serializes writes per `sessionId` with `pg_advisory_xact_lock` inside a transaction.
  - ticket-scoped artifact writes (`ticket_ssot`, `ticket_text_artifact`, `ticket_context_appendix`) now use an atomic upsert guarded by the latest triage session for the ticket.
- `apps/api/src/services/prepare-context.ts`
  - legacy persistence exports now delegate to the shared concurrency-safe persistence implementation.
- `apps/api/src/services/application/route-handlers/integrations-route-handlers.ts`
  - `withTimeout()` now clears the losing timeout path when the wrapped operation resolves first.
- `apps/api/src/services/orchestration/triage-orchestrator.ts`
  - retry listener interval now uses `unref()` when available.
- `apps/api/src/services/adapters/autotask-polling.ts`
  - poll interval now uses `unref()` when available.
- Tests added/updated:
  - `apps/api/src/__tests__/routes/integrations.credentials.test.ts`
  - `apps/api/src/__tests__/services/context-persistence.test.ts`
  - `apps/api/src/__tests__/services/prepare-context-persistence-bridge.test.ts`
  - `apps/api/src/__tests__/services/autotask-polling.test.ts`
  - `apps/api/src/__tests__/services/triage-orchestrator-tenant.test.ts`

# Why it changed
- Concurrent writes to `evidence_packs` could race and double-insert for the same session.
- A stale triage session could still overwrite the newest SSOT/text artifact/appendix for a ticket because the code checked freshness before writing instead of during the write.
- A legacy prepare-context path still exposed the old persistence behavior, so part of the runtime could bypass the fix.
- Background intervals in the active orchestrator and Autotask poller could keep the Node process alive after useful work had finished.
- A timeout helper in integrations health checks could leave a timer alive after a fast success path.

# Impact (UI / logic / data)
- UI:
  - no direct visual change.
- Logic:
  - persistence of triage artifacts is now race-safe for concurrent sessions and concurrent evidence-pack saves.
  - legacy prepare-context exports now share the same persistence behavior as the current context module.
  - background poller/retry timers no longer pin the process by themselves.
  - fast integration health checks no longer leave a dangling timeout handle behind.
- Data:
  - reduces risk of duplicate `evidence_packs` rows for the same `session_id`.
  - reduces risk of stale ticket artifacts overwriting the latest triage output for a ticket.

# Files touched
- `apps/api/src/services/context/persistence.ts`
- `apps/api/src/services/prepare-context.ts`
- `apps/api/src/services/application/route-handlers/integrations-route-handlers.ts`
- `apps/api/src/services/orchestration/triage-orchestrator.ts`
- `apps/api/src/services/adapters/autotask-polling.ts`
- `apps/api/src/__tests__/routes/integrations.credentials.test.ts`
- `apps/api/src/__tests__/services/context-persistence.test.ts`
- `apps/api/src/__tests__/services/prepare-context-persistence-bridge.test.ts`
- `apps/api/src/__tests__/services/autotask-polling.test.ts`
- `apps/api/src/__tests__/services/triage-orchestrator-tenant.test.ts`

# Date
- 2026-03-06
