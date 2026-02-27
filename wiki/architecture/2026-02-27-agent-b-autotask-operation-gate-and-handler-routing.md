# Title
Autotask Phase 1 operation gate and handler routing (Agent B)

# What changed
- Introduced a dedicated operation registry layer to resolve command type -> canonical operation -> handler kind -> audit action.
- Wired registry enforcement into `TicketWorkflowCoreService` submit/process paths.
- Wired registry-based dispatch into `AutotaskTicketWorkflowGateway`.
- Kept legacy `update` path as compatibility mode, but constrained to approved matrix-safe mutations.

# Why it changed
- The frozen matrix is the source of truth and needed deterministic runtime enforcement.
- Previous flow validated only integration target (`Autotask`) and did not enforce operation-level matrix scope.

# Impact (UI / logic / data)
- UI: none.
- Logic: operation guardrails now fail closed for out-of-matrix commands and blocked legacy update fields.
- Data: no DB migration; additional audit metadata fields provide operation/handler traceability.

# Files touched
- `apps/api/src/services/autotask-operation-registry.ts`
- `apps/api/src/services/ticket-workflow-core.ts`
- `apps/api/src/services/autotask-ticket-workflow-gateway.ts`
- `docs/contracts/autotask-phase1-full-api-capability-matrix.md` (consumed as frozen source of truth; no edit in this change)

# Date
2026-02-27
