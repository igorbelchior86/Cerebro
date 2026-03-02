# Title
Phase 7 Observability Correlation Completion (Architecture)

# What changed
Replaced remaining `console.*` in the requested production-critical scope with structured `operationalLogger` events.
Added correlation propagation in changed code paths using available context (`tenant_id`, `ticket_id`, `trace_id`) and logger fallback context.
Standardized external-failure logging in changed integration-related catches with explicit operational signals (`signal=integration_failure`, `degraded_mode=true`) where applicable.

# Why it changed
To complete observability standardization and ensure production logs emit consistent correlation metadata for tenant/ticket/trace investigations.
To eliminate unstructured logs in critical modules and reduce silent degradation risk in integration paths.

# Impact (UI / logic / data)
UI: No impact.
Logic: No business-rule changes; only logging mechanism and payload structure changed.
Data: No schema or API contract changes.

# Files touched
- apps/api/src/middleware/error-handler.ts
- apps/api/src/db/pool.ts
- apps/api/src/db/seed-admin.ts
- apps/api/src/services/read-models/runtime-json-file.ts
- apps/api/src/services/read-models/runtime-settings.ts
- apps/api/src/services/context/history-resolver.ts
- apps/api/src/services/context/enrichment-cache.ts
- apps/api/src/services/context/persistence.ts
- apps/api/src/services/context/prepare-context.ts
- tasks/todo.md

# Date
2026-03-02
