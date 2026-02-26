# Title
CP0 Platform Foundations + Contract Freeze (Agent A)

# What changed
- Added CP0 shared contracts package exports (`CP0*`) for canonical ticket/context/command/event/audit/AI decision/queue/adapter/policy/credentials/feature-flag primitives.
- Added API platform scaffolding (`apps/api/src/platform/*`) for request correlation, observability baseline, tenant/RBAC hooks, audit trail, feature flags, credentials, queue retry/DLQ skeleton, worker runtime scaffold, and integration mode guardrail.
- Added CP0 unit tests for tenant scope, idempotency primitive, retry/DLQ skeleton, policy guardrail (Autotask allowed, others rejected), and correlation logging/metrics hooks.
- Updated API bootstrap/auth context wiring and Jest resolver behavior for ESM shared-type re-exports.

# Why it changed
To complete CP0 (contract freeze) and provide stable platform primitives for parallel workstreams (Agents B/C) without implementing P1/P2 or business workflow logic.

# Impact (UI / logic / data)
- UI: None.
- Logic: New enforceable policy/audit/queue/observability primitives available for downstream implementations.
- Data: No DB migration; contract-only + in-memory scaffolding additions.

# Files touched
- `packages/types/src/cp0-contracts.ts`
- `packages/types/src/index.ts`
- `apps/api/src/platform/*`
- `apps/api/src/index.ts`
- `apps/api/src/lib/tenantContext.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/__tests__/platform/*`
- `apps/api/jest.config.js`
- `tasks/todo.md`

# Date
2026-02-26
