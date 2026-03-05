# Autotask Poller Pagination And Tenant Claim Fix

# What changed
- `packages/integrations/src/autotask/client.ts` now follows Autotask `pageDetails.nextPageUrl` for `searchTickets()` until pagination is exhausted, with loop and page-count safeguards.
- `apps/api/src/services/adapters/autotask-polling.ts` now propagates `tenant_id` when dispatching triage runs from the poller.
- `apps/api/src/services/orchestration/triage-orchestrator.ts` now performs tenant-scoped claim/create for `triage_sessions` when a tenant context is provided, and the retry sweep now carries `tenant_id` forward.
- Added regressions in `apps/api/src/__tests__/clients/autotask.test.ts`, `apps/api/src/__tests__/services/autotask-polling.test.ts`, and `apps/api/src/__tests__/services/triage-orchestrator-tenant.test.ts`.

# Why it changed
- The PSA connector was truncating ticket ingestion at the first `/tickets/query` page, so old tickets stayed unhydrated indefinitely.
- After ingestion, the poller was dispatching triage without `tenant_id`, and the orchestrator created sessions in the oldest tenant in the database. That broke tenant-scoped credential resolution and caused `prepare_context` to fail with `401 Unauthorized`.

# Impact (UI / logic / data)
- UI: older active tickets are no longer permanently excluded from hydration just because they were beyond the first PSA page.
- Logic: poller parity/backfill now sees the complete Autotask result set, and background triage stays inside the same tenant that produced the sync event.
- Data: new `triage_sessions` and `ticket_ssot` records are now persisted under the correct tenant, preventing cross-tenant drift and restoring canonical `Org / Requester / Contact` persistence.

# Files touched
- `packages/integrations/src/autotask/client.ts`
- `apps/api/src/services/adapters/autotask-polling.ts`
- `apps/api/src/services/orchestration/triage-orchestrator.ts`
- `apps/api/src/__tests__/clients/autotask.test.ts`
- `apps/api/src/__tests__/services/autotask-polling.test.ts`
- `apps/api/src/__tests__/services/triage-orchestrator-tenant.test.ts`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-05
