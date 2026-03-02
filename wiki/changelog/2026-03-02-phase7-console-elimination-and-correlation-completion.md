# Title
Phase 7 Console Elimination and Correlation Completion

# What changed
- Replaced all remaining `console.log/info/warn/error` occurrences in `apps/api/src` with `operationalLogger`.
- Standardized route-level logging in auth, workflow realtime, and email-ingestion handlers with structured event names.
- Added request correlation helpers in HTTP handlers to propagate `tenant_id`, `trace_id`, and `ticket_id` when applicable.
- Replaced DB and AI service console outputs with structured operational events.

# Why it changed
- Enforce a single production logging standard for the API.
- Ensure consistent correlation metadata for operational debugging and tracing.
- Prevent accidental unstructured logs and reduce secret leakage risk via safe error serialization.

# Impact (UI / logic / data)
- UI: none.
- Logic: no business-rule changes; logging-only refactor.
- Data: no schema/storage changes.

# Files touched
- `apps/api/src/services/application/route-handlers/auth-route-handlers.ts`
- `apps/api/src/services/application/route-handlers/workflow-route-handlers.ts`
- `apps/api/src/services/application/route-handlers/email-ingestion-route-handlers.ts`
- `apps/api/src/db/index.ts`
- `apps/api/src/services/ai/diagnose.ts`
- `apps/api/src/services/ai/llm-adapter.ts`
- `apps/api/src/services/ai/web-search.ts`
- `tasks/todo.md`

# Date
2026-03-02
