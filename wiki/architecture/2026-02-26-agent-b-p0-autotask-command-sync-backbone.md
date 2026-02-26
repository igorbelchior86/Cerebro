# Title
P0 Autotask Command/Sync Backbone Architecture (Agent B)

# What changed
Documented the Agent B P0 runtime architecture for Autotask two-way workflow execution: command envelope intake (`/workflow/commands`), in-process worker sweep (`/workflow/commands/process`), Autotask adapter gateway execution, local inbox projection updates, sync event ingestion (`/workflow/sync/autotask`), and reconciliation issue surfacing (`/workflow/reconcile/:ticketId`).

# Why it changed
The P0 contract requires a deterministic command/sync backbone with idempotency, audit/provenance, retry/DLQ behavior, and divergence visibility while preserving the launch integration policy (Autotask only as two-way; others read-only).

# Impact (UI / logic / data)
UI: Enables a unified inbox workflow integration path backed by normalized command/event envelopes.
Logic: Centralizes policy checks (non-Autotask write rejection), command execution state machine (accepted -> processing -> completed/retry_pending/failed/dlq), and sync duplicate/out-of-order protection.
Data: Local runtime state currently uses an in-memory repository abstraction to minimize impact on existing DB/RLS tables; audit records and reconciliation issues are available through service APIs but are not durable across process restarts in this P0 cut.

# Files touched
- apps/api/src/services/ticket-workflow-core.ts
- apps/api/src/services/autotask-ticket-workflow-gateway.ts
- apps/api/src/routes/workflow.ts

# Date
2026-02-26
