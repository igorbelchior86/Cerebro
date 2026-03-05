# Title
Phase 7 Logging Standard Final (API)

# What changed
- Consolidated production logging to `operationalLogger` across remaining API production files.
- Removed all `console.log/info/warn/error` from `apps/api/src`.
- Enforced structured event naming and payloads in affected modules.
- Added explicit request-derived correlation metadata in route handlers:
  - `tenant_id` from authenticated request context when present.
  - `trace_id` from `x-correlation-id`/`x-trace-id` headers when present.
  - `ticket_id` when ticket-scoped operations are present.

# Why it changed
- Keep observability deterministic and queryable in production.
- Guarantee correlation continuity across route/worker/service boundaries.
- Reduce operational blind spots from ad-hoc console logging.

# Impact (UI / logic / data)
- UI: no impact.
- Logic: no business behavior changes; observability surface only.
- Data: no DB migration or persisted model changes.

# Files touched
- `apps/api/src/services/application/route-handlers/auth-route-handlers.ts`
- `apps/api/src/services/application/route-handlers/workflow-route-handlers.ts`
- `apps/api/src/services/application/route-handlers/ticket-intake-route-handlers.ts`
- `apps/api/src/db/index.ts`
- `apps/api/src/services/ai/diagnose.ts`
- `apps/api/src/services/ai/llm-adapter.ts`
- `apps/api/src/services/ai/web-search.ts`

# Date
2026-03-02
