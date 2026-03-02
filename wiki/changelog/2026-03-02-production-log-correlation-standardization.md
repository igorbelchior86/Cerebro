# Production Log Correlation Standardization
# What changed
- Introduced `operationalLogger` with structured payloads and mandatory correlation keys (`tenant_id`, `ticket_id`, `trace_id` when available) for API critical flows.
- Migrated critical logging away from `console.*` in:
  - `apps/api/src/routes/ai/*`
  - `apps/api/src/services/adapters/*`
  - `apps/api/src/services/orchestration/*`
  - `apps/api/src/services/read-models/data-fetchers/*`
- Added structured operational failure signaling on integration failures.
- Added logger correlation unit test.

# Why it changed
- Ensure production logs are correlatable and operationally actionable across tenant, ticket, and trace context.

# Impact (UI / logic / data)
- UI: none.
- Logic: no business behavior changes; only observability/logging behavior changed.
- Data: none.

# Files touched
- `apps/api/src/lib/operational-logger.ts`
- `apps/api/src/index.ts`
- `apps/api/src/routes/ai/diagnose.ts`
- `apps/api/src/services/application/route-handlers/playbook-route-handlers.ts`
- `apps/api/src/services/adapters/autotask-polling.ts`
- `apps/api/src/services/adapters/email-ingestion-polling.ts`
- `apps/api/src/services/adapters/email/email-parser.ts`
- `apps/api/src/services/adapters/email/graph-client.ts`
- `apps/api/src/services/adapters/email/pg-store.ts`
- `apps/api/src/services/orchestration/fusion-engine.ts`
- `apps/api/src/services/orchestration/ticket-workflow-core.ts`
- `apps/api/src/services/orchestration/triage-orchestrator.ts`
- `apps/api/src/services/read-models/data-fetchers/autotask-fetcher.ts`
- `apps/api/src/services/read-models/data-fetchers/itglue-fetcher.ts`
- `apps/api/src/services/read-models/data-fetchers/ninjaone-fetcher.ts`
- `apps/api/src/__tests__/platform/operational-logger.test.ts`
- `apps/api/src/services/workflow/triage-session.ts`

# Date
- 2026-03-02
