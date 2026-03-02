# Title
Changelog: Phase 3 Thin Routes Finalization (Workflow/Ops)

# What changed
- Completed thin-route migration for remaining workflow/ops routes.
- Route modules were reduced to thin wrappers, delegating business logic to application route-handler modules.
- Added workflow runtime compatibility export to preserve test import path compatibility.

# Why it changed
- Enforce route responsibility boundaries and complete Phase 3 architecture target (business logic outside routes).

# Impact (UI / logic / data)
- UI: unchanged.
- Logic: behavior preserved; internal code organization improved.
- Data: unchanged.

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
