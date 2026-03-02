# Production Log Correlation Standardization
# What changed
- Consolidated API runtime logging through a single operational logger in `apps/api/src/lib/operational-logger.ts`, reusing the observability runtime and injecting correlation fields (`tenant_id`, `ticket_id`, `trace_id`, plus request/job/command ids).
- Replaced `console.*` calls in critical routes/adapters/orchestration/read-model fetchers with structured `operationalLogger.info|warn|error` events.
- Added explicit structured operational failure signals for integration paths (`signal: integration_failure`, `degraded_mode: true`) in polling/fetcher/adapter failures.
- Wired API bootstrap and unhandled error handler to the same operational logger/runtime in `apps/api/src/index.ts`.
- Added test coverage for logger correlation propagation in `apps/api/src/__tests__/platform/operational-logger.test.ts`.

# Why it changed
- Production observability required mandatory, correlatable identifiers on critical logs to support incident triage and cross-service traceability.
- Existing `console.*` usage in critical paths emitted unstructured messages and made correlation/auditing inconsistent.

# Impact (UI / logic / data)
- UI: no change.
- Logic: no business rule changes; only logging emission path and log structure were changed.
- Data: no persistence schema/data contract changes; runtime log payload now consistently carries correlation keys.

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
