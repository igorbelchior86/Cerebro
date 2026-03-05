# Canonical JSON Pipeline v5 Execution (Strong Consistency)
# What changed
- Added shared V1 canonical pipeline contracts in `packages/types`:
  - `CanonicalEventV1`
  - `CanonicalTicketSnapshotV1`
  - `BlockConsistencyStateV1`
  - `PipelineStatusV1`
  - `ConnectorCommandStateV1`
- Extended workflow core (`apps/api`) to persist and derive pipeline consistency state per ticket:
  - Block states: `core_state`, `network_env_body_state`, `hypothesis_checklist_state`
  - Pipeline states: `queued | processing | retry_scheduled | degraded | dlq | ready`
  - Operational fields: `processing_lag_ms`, `next_retry_at`, `retry_count`, `dlq_id`, `last_background_processed_at`, `consistent_at`, `trace_id`
- Implemented deterministic warm-queue scoring and tie-break with explicit first-seen TTL:
  - Score = `w1*recency + w2*sla_risk + w3*business_priority + w4*state_staleness + w5*first_seen_boost`
  - Weights: `0.35 / 0.30 / 0.20 / 0.10 / 0.05`
  - `first_seen_boost` TTL = 15 minutes
  - Tie-break order: score desc -> sla_risk desc -> created_at asc -> ticket_id lexicographic
- Included Ticket Body in Block B derivation and canonical snapshots.
- Added new workflow read/ops endpoints:
  - `GET /workflow/tickets/:ticketId`
  - `GET /workflow/tickets/:ticketId/commands`
  - `POST /workflow/tickets/:ticketId/reconcile` (alias, legacy route preserved)
- Updated web API client types/functions for new snapshot and commands endpoints.
- Added/updated test coverage for:
  - Route compatibility (legacy + v1 reconcile)
  - Ticket snapshot/commands route payloads
  - Scheduler ordering + `first_seen_boost` TTL behavior
  - Pipeline status transitions `retry_scheduled -> dlq`

# Why it changed
- Implement the approved v5 plan with explicit product priority: consistency first, without excessive perceived latency.
- Eliminate ambiguity in UI/API when workers are in retry or DLQ.
- Guarantee deterministic prioritization in warm/background processing.
- Expose canonical ticket read model and command state in a form usable by troubleshooting UI blocks A/B/C.

# Impact (UI / logic / data)
- UI:
  - New API surfaces available for block-driven rendering and operational states.
  - Inbox payload now carries optional pipeline metadata (backward compatible).
- Logic:
  - Background processing now writes explicit consistency/pipeline states.
  - Deterministic scheduling score and tie-break now applied in warm queue selection and inbox ordering.
  - Command lifecycle now updates ticket pipeline semantics for retry/DLQ visibility.
- Data:
  - In-memory workflow ticket model expanded with pipeline and block consistency fields.
  - No destructive migration required (optional fields only).

# Files touched
- `packages/types/src/canonical-json-pipeline-v1.ts`
- `packages/types/src/index.ts`
- `apps/api/src/services/orchestration/ticket-workflow-core.ts`
- `apps/api/src/services/application/route-handlers/workflow-route-handlers.ts`
- `apps/api/src/__tests__/services/ticket-workflow-core.test.ts`
- `apps/api/src/__tests__/routes/workflow.reconcile-route.test.ts`
- `apps/web/src/lib/p0-ui-client.ts`
- `tasks/todo.md`

# Date
- 2026-03-05
