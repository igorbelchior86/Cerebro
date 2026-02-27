# Title
Decision - Enforce Typed Reconcile Route Failure Contract Coverage

# What changed
Recorded decision to enforce route-level tests for `WorkflowReconcileFetchError` payload shape (`statusCode`, `retryable`, `classification`, `operation`) and operation-alias audit metadata assertions in workflow-core failure paths.

# Why it changed
Without direct tests, regressions in operator-facing error payloads and operation metadata could become silent despite runtime support.

# Impact (UI / logic / data)
UI: No impact.
Logic: No behavior change; tighter regression guardrails for failure observability.
Data: No data model change.

# Files touched
- apps/api/src/__tests__/routes/workflow.reconcile-route.test.ts
- apps/api/src/__tests__/services/ticket-workflow-core.test.ts

# Date
2026-02-27
