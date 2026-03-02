# Title
Phase 7 Observability Correlation Completion

# What changed
Removed all remaining `console.log/info/warn/error` usage in the scoped targets:
- `apps/api/src/services/adapters/**`
- `apps/api/src/services/orchestration/**`
- `apps/api/src/services/read-models/**`
- `apps/api/src/services/context/**`
- `apps/api/src/db/**`
- `apps/api/src/index.ts`
- `apps/api/src/middleware/error-handler.ts`

Replaced logs with `operationalLogger` structured events and correlation fields.
Ensured integration-failure paths changed in this patch emit structured operational signals when they degrade/fallback.

# Why it changed
To finalize phase 7 observability hardening and make correlation metadata consistent across production-critical modules in the defined scope.

# Impact (UI / logic / data)
UI: None.
Logic: Logging-only changes; no business logic behavior or API contract changes.
Data: None.

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
- wiki/architecture/2026-03-02-phase7-observability-correlation-completion.md

# Date
2026-03-02
