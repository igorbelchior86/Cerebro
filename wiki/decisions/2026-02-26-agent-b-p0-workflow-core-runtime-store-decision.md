# Title
Decision: P0 Agent B Workflow Core Uses In-Memory Runtime Store (Repository Abstraction)

# What changed
Chose an in-memory repository implementation (`InMemoryTicketWorkflowRepository`) behind a `TicketWorkflowRepository` interface for P0 command queue state, inbox projections, sync dedupe markers, audit records, and reconciliation issues.

# Why it changed
The repo already has active parallel changes (Agent A/Agent C) and no obvious finalized durable queue/DLQ primitive wiring available in the current branch context. Using a repository abstraction allows delivering P0 command/sync semantics and tests immediately without redefining CP0 shared contracts or introducing risky schema/RLS changes during parallel integration.

# Impact (UI / logic / data)
UI: No direct UI impact; endpoints work during process lifetime.
Logic: Full P0 semantics are implemented at service level (policy, idempotency, retry/DLQ classification, sync handling, reconciliation surfacing).
Data: Runtime-only persistence is a known limitation; command/audit/inbox state resets on API restart and should be migrated to Agent A durable primitives / DB tables in a follow-up hardening step.

# Files touched
- apps/api/src/services/ticket-workflow-core.ts
- apps/api/src/routes/workflow.ts

# Date
2026-02-26
