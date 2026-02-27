# Title
Decision - Typed Reconcile Fetch Error + Domain Classification Contract

# What changed
Adopted a typed reconcile fetch error (`WorkflowReconcileFetchError`) carrying classification, HTTP status, retryability, and operation disposition metadata. Reconcile result contract was expanded to include aggregate and per-domain classification.

# Why it changed
This keeps failures actionable and non-silent at runtime and route boundaries, while enabling deterministic operational handling and validation evidence for Agent C acceptance.

# Impact (UI / logic / data)
UI: None.
Logic: Route and service layers share a deterministic failure contract; reconcile output is domain-aware.
Data: Audit events include operation outcomes and domain classification payloads.

# Files touched
- apps/api/src/services/ticket-workflow-core.ts
- apps/api/src/routes/workflow.ts
- apps/api/src/__tests__/services/ticket-workflow-core.test.ts
- apps/api/src/__tests__/routes/workflow.reconcile-route.test.ts

# Date
2026-02-27
