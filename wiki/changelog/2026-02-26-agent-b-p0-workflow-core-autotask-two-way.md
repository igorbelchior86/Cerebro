# Title
Agent B P0: Autotask Two-Way Workflow Core + Unified Inbox Backbone

# What changed
Implemented a new P0 workflow core for Autotask-only ticket commands and sync events, added `/workflow` protected routes, added Autotask write client methods, and added a focused test suite covering idempotency, policy rejection, sync duplicate/out-of-order handling, audit/provenance, retry/DLQ, happy path, and reconciliation divergence.

# Why it changed
This provides the Agent B P0 backbone needed to execute/create/assign/update ticket lifecycle actions through Cerebro while keeping non-Autotask integrations read-only and making sync/reconciliation behavior explicit.

# Impact (UI / logic / data)
UI: Backend APIs for P0 inbox/workflow are now available (`/workflow/*`).
Logic: Adds command envelopes, worker processing loop, Autotask gateway execution, and reconciliation issue surfacing.
Data: No migration in this delivery; state is in-memory and reset on restart (documented follow-up risk).

# Files touched
- apps/api/src/services/ticket-workflow-core.ts
- apps/api/src/services/autotask-ticket-workflow-gateway.ts
- apps/api/src/routes/workflow.ts
- apps/api/src/clients/autotask.ts
- apps/api/src/index.ts
- apps/api/src/__tests__/services/ticket-workflow-core.test.ts

# Date
2026-02-26
