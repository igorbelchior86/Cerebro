# Phase 4 Reconcile Fetch Failure Classification Audit Path
# What changed
`TicketWorkflowCoreService.reconcileTicket(...)` now classifies gateway fetch failures using platform queue-error classification and writes `workflow.reconciliation.fetch_failed` audit records with retry/degraded metadata before rethrowing to the route layer.
# Why it changed
The reconcile flow previously lost operational semantics for upstream throttling/timeouts, causing route-level generic failures and weaker observability during Phase 4 validation.
# Impact (UI / logic / data)
Logic/architecture: clearer separation of concerns (service owns auditability, route owns HTTP response contract). UI/API: operator receives actionable status. Data: additional audit metadata fields only; no persistence schema changes.
# Files touched
`apps/api/src/services/ticket-workflow-core.ts`, `apps/api/src/routes/workflow.ts`, `apps/api/src/__tests__/services/ticket-workflow-core.test.ts`, `apps/api/src/__tests__/routes/workflow.reconcile-route.test.ts`
# Date
2026-02-26
