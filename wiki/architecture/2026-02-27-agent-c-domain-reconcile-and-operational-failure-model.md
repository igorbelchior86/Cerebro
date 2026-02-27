# Title
Agent C Architecture - Domain Reconcile + Operational Failure Model

# What changed
Defined an explicit reconcile model by domain (`tickets`, `ticket_notes`, `correlates.resources`, `correlates.ticket_metadata`, `correlates.ticket_note_metadata`) and introduced an operational failure model that classifies reconcile fetch failures with bounded retries and DLQ transition semantics. Sync ingestion path now has poller retry queue semantics for transient failures.

# Why it changed
The previous implementation had partial reconcile semantics and did not encode explicit operation outcome contracts (`retry_pending`/`dlq`) for all failure classes in sync ingestion and reconcile fetch.

# Impact (UI / logic / data)
UI: None.
Logic: Adds deterministic operational state transitions and domain-level reconciliation comparators.
Data: Domain snapshots are persisted in inbox runtime state and emitted in audit metadata for operator traceability.

# Files touched
- apps/api/src/services/ticket-workflow-core.ts
- apps/api/src/services/autotask-polling.ts
- apps/api/src/services/autotask-ticket-workflow-gateway.ts
- apps/api/src/routes/workflow.ts

# Date
2026-02-27
