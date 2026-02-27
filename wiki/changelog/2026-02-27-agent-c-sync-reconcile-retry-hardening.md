# Title
Changelog - Agent C Sync/Reconcile Retry Hardening

# What changed
Implemented domain-aware sync/reconcile runtime updates, explicit reconcile fetch failure typing, poller retry/backoff/DLQ handling for sync ingestion, and expanded failure-path tests (429/timeout/retry/DLQ/degraded).

# Why it changed
To meet Agent C acceptance for full operational sync/reconcile behavior with explicit observability and non-silent fault handling.

# Impact (UI / logic / data)
UI: No impact.
Logic: Improved resilience and deterministic failure handling in sync/reconcile.
Data: Additional domain snapshot and audit metadata persisted in runtime state.

# Files touched
- apps/api/src/services/ticket-workflow-core.ts
- apps/api/src/services/autotask-polling.ts
- apps/api/src/services/autotask-ticket-workflow-gateway.ts
- apps/api/src/routes/workflow.ts
- apps/api/src/__tests__/services/ticket-workflow-core.test.ts
- apps/api/src/__tests__/services/autotask-polling.test.ts
- apps/api/src/__tests__/routes/workflow.reconcile-route.test.ts
- tasks/todo.md

# Date
2026-02-27
