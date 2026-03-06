# Title
API lint warning cleanup round 5: zero-warning finish

# What changed
- Finished the remaining API lint cleanup and brought `apps/api` from `598` warnings at the start of this round to `0`.
- Reworked the largest remaining files to stop relying on broad `any` casts:
  - `apps/api/src/services/context/prepare-context.ts`
  - `apps/api/src/services/application/route-handlers/playbook-route-handlers.ts`
  - `apps/api/src/services/application/route-handlers/autotask-route-handlers.ts`
  - `apps/api/src/services/application/route-handlers/ticket-intake-route-handlers.ts`
  - `apps/api/src/services/application/route-handlers/workflow-route-handlers.ts`
- Cleaned the remaining long-tail warnings in smaller route handlers, middleware, scripts, services, and tests.
- Kept the cleanup behavior-preserving: the changes were focused on explicit typing, safer narrowing, and removal of unused variables/imports.

# Why it changed
- The repo still carried hundreds of API lint warnings, mostly `@typescript-eslint/no-explicit-any` and `no-unused-vars`.
- Those warnings made real regressions harder to spot and made the code less predictable in critical route and context paths.
- The goal of this round was to finish the warning-reduction plan instead of leaving the repo half-cleaned.

# Impact (UI / logic / data)
- UI: no intended UI behavior change.
- Logic: no intended business-rule change; route handlers now read external/provider payloads through explicit record narrowing instead of unchecked `any`.
- Data: no schema or stored-data change.

# Files touched
- `apps/api/src/services/context/prepare-context.ts`
- `apps/api/src/services/application/route-handlers/playbook-route-handlers.ts`
- `apps/api/src/services/application/route-handlers/autotask-route-handlers.ts`
- `apps/api/src/services/application/route-handlers/ticket-intake-route-handlers.ts`
- `apps/api/src/services/application/route-handlers/workflow-route-handlers.ts`
- `apps/api/src/services/application/route-handlers/auth-saml-route-handlers.ts`
- `apps/api/src/services/application/route-handlers/manager-ops-route-handlers.ts`
- `apps/api/src/services/application/route-handlers/diagnose-route-handlers.ts`
- `apps/api/src/services/application/route-handlers/triage-route-handlers.ts`
- `apps/api/src/services/ai/p0-ai-triage-assist.ts`
- `apps/api/src/services/ai/p0-manager-ops-visibility.ts`
- `apps/api/src/services/context/persistence.ts`
- `apps/api/src/check-ticket-payload.ts`
- `apps/api/src/middlewares/tenant.ts`
- `apps/api/src/index.ts`
- `apps/api/src/__tests__/platform/observability-correlation.test.ts`
- `apps/api/src/__tests__/routes/triage.integration.test.ts`
- `apps/api/src/__tests__/services/diagnose-calibration.test.ts`
- `apps/api/src/__tests__/services/diagnose-fail-fast.test.ts`
- `apps/api/src/__tests__/services/playbook-writer-structure.test.ts`
- `apps/api/src/__tests__/services/prepare-context.test.ts`
- `tasks/todo.md`

# Date
2026-03-06
