# Title
Agent C - Sync/Reconcile Operational Hardening (Domain Coverage + Retry/DLQ)

# What changed
Extended Autotask sync ingestion and reconcile runtime to include domain-normalized snapshots and explicit reconcile classification (`match`, `mismatch`, `missing_snapshot`, `fetch_failed`, `skipped`). Added explicit operational retry/backoff/DLQ behavior for sync ingestion failures (poller retry queue) and reconcile fetch failures (typed error with operation outcome metadata).

# Why it changed
Phase 1/Agent C scope requires full operational observability and deterministic failure behavior across sync/reconcile paths, with non-silent failures and auditable degraded mode.

# Impact (UI / logic / data)
UI: No UI change.
Logic: Reconcile now returns per-domain classification and aggregate outcome; sync/reconcile failures include explicit operation disposition and degraded signals.
Data: Inbox projection now stores `domain_snapshots`; audit payloads include domain classification and operation metadata.

# Files touched
- apps/api/src/services/ticket-workflow-core.ts
- apps/api/src/services/autotask-polling.ts
- apps/api/src/services/autotask-ticket-workflow-gateway.ts
- apps/api/src/routes/workflow.ts
- apps/api/src/__tests__/services/ticket-workflow-core.test.ts
- apps/api/src/__tests__/services/autotask-polling.test.ts
- apps/api/src/__tests__/routes/workflow.reconcile-route.test.ts

# Date
2026-02-27
