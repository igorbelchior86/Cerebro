# Title
Agent B P0 Workflow Core (Autotask Two-Way + Unified Inbox Backbone)

# What changed
Added a P0 ticket workflow core service for Autotask-only command execution with command envelopes, idempotency handling, audit/provenance emission, sync event ingestion, inbox projection updates, retry/DLQ semantics, and reconciliation issue surfacing. Added protected `/workflow` API routes for command submission/processing, sync ingestion, inbox listing, audit listing, and reconciliation checks. Extended `AutotaskClient` with P0 write methods (`createTicket`, `updateTicket`, `createTicketNote`, `createTimeEntry`).

# Why it changed
Agent B P0 scope requires a working Autotask two-way path (create/assign/update/status/time entry support), unified inbox state updates from sync events, and explicit guardrails/auditability without enabling writes for other integrations.

# Impact (UI / logic / data)
UI: New backend endpoints are available for a P0 inbox/workflow UI path (`/workflow/*`).
Logic: Adds Autotask-only command policy enforcement, retry-safe command processing, sync duplicate/out-of-order handling, and divergence detection.
Data: In this P0 implementation, workflow command/inbox/sync state is stored in an in-memory runtime repository (non-durable) and exposed through API responses; no DB schema migration was introduced.

# Files touched
- apps/api/src/services/ticket-workflow-core.ts
- apps/api/src/services/autotask-ticket-workflow-gateway.ts
- apps/api/src/routes/workflow.ts
- apps/api/src/clients/autotask.ts
- apps/api/src/index.ts
- apps/api/src/__tests__/services/ticket-workflow-core.test.ts

# Date
2026-02-26
