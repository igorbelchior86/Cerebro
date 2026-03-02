# Title
Phase 3 Thin Routes Finalization (Workflow/Ops)

# What changed
- Finalized thin-route extraction for the remaining workflow/ops endpoints by moving route business logic into `services/application/route-handlers`.
- Replaced these route files with thin wrappers that only export the handler routers:
  - `apps/api/src/routes/workflow/chat.ts`
  - `apps/api/src/routes/workflow/workflow.ts`
  - `apps/api/src/routes/ops/manager-ops.ts`
  - `apps/api/src/routes/workflow/prepare-context.ts`
  - `apps/api/src/routes/workflow/triage.ts`
- Added handler modules with the previously in-route SQL/orchestration/transformations:
  - `apps/api/src/services/application/route-handlers/chat-route-handlers.ts`
  - `apps/api/src/services/application/route-handlers/workflow-route-handlers.ts`
  - `apps/api/src/services/application/route-handlers/manager-ops-route-handlers.ts`
  - `apps/api/src/services/application/route-handlers/prepare-context-route-handlers.ts`
  - `apps/api/src/services/application/route-handlers/triage-route-handlers.ts`
- Added compatibility bridge for workflow runtime import path used by route tests:
  - `apps/api/src/services/workflow-runtime.ts`

# Why it changed
- Close Phase 3 objective: routes should remain HTTP-focused (input validation, service invocation, HTTP mapping), while business logic lives in application/domain layers.
- Reduce coupling and improve maintainability/testability without changing HTTP contracts, auth/session/RBAC/tenant semantics, or queue/retry/idempotency behavior.

# Impact (UI / logic / data)
- UI: no impact.
- Logic: no semantic behavior change intended; logic was moved (not redesigned) from route modules to handler modules.
- Data: no schema changes, no migration, no persistence contract changes.

# Files touched
- `apps/api/src/routes/workflow/chat.ts`
- `apps/api/src/routes/workflow/workflow.ts`
- `apps/api/src/routes/ops/manager-ops.ts`
- `apps/api/src/routes/workflow/prepare-context.ts`
- `apps/api/src/routes/workflow/triage.ts`
- `apps/api/src/services/application/route-handlers/chat-route-handlers.ts`
- `apps/api/src/services/application/route-handlers/workflow-route-handlers.ts`
- `apps/api/src/services/application/route-handlers/manager-ops-route-handlers.ts`
- `apps/api/src/services/application/route-handlers/prepare-context-route-handlers.ts`
- `apps/api/src/services/application/route-handlers/triage-route-handlers.ts`
- `apps/api/src/services/workflow-runtime.ts`

# Date
2026-03-02
