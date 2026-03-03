# Orchestration Health Stability + Observability + Typecheck Cleanup
# What changed
- Added orchestration runtime guards in `triage-orchestrator`:
- Serialized pipeline execution with a local queue to avoid overlapping heavy runs.
- Added stage timeout guard (`TRIAGE_STAGE_TIMEOUT_MS`) for `prepare_context`, `diagnose`, and `playbook`.
- Added queue wait warning and per-stage completion logs.
- Added API event loop lag observability:
- New monitor with `monitorEventLoopDelay` and periodic logs (`api.runtime.event_loop_lag` / `api.runtime.event_loop_lag_high`).
- Added phase-level timing in `prepare-context`:
- New `context.prepare_context.phase_completed` logs for `intake_normalization`, `itglue_round`, `ninja_round`, `history_refinement`, `broad_history_correlation`, `final_refinement`, and `finalize_evidence_pack`.
- Removed major synchronous persistence bottleneck in workflow runtime:
- Added debounce for persistence writes in `InMemoryTicketWorkflowRepository`.
- In test runtime (`NODE_ENV=test`), persistence debounce is forced to immediate flush to keep repository reload tests deterministic.
- Added bounded retention for audits/reconciliation/processsed-events.
- Capped comments per ticket in workflow projection.
- Removed write-side effects from `listInbox()` read path.
- Reduced JSON persistence payload overhead in runtime JSON helpers (no pretty-print indentation).
- Fixed legacy type imports causing API typecheck failures:
- Replaced `@playbook/types` with `@cerebro/types` in legacy API service files.

# Why it changed
- API became intermittently unresponsive (`/health` timeouts) under heavy orchestration.
- Runtime profiling showed event-loop blocking dominated by synchronous `JSON.stringify` and synchronous file writes.
- Workflow inbox read path was doing expensive dedupe writes during GET, amplifying blocking.
- `@cerebro/api` typecheck still failed due legacy unresolved type package imports.

# Impact (UI / logic / data)
- UI:
- No contract changes expected for inbox payload shape; improves responsiveness of login/sidebar/home flows that depend on `/workflow/inbox`.
- Logic:
- Orchestration now has explicit local concurrency guard and bounded stage runtime.
- Workflow runtime persistence is now batched/debounced and bounded to avoid main-thread stalls.
- Workflow runtime persistence remains deterministic under tests (no deferred flush race in reload assertions).
- Prepare-context now emits deterministic per-phase timing telemetry.
- Data:
- Runtime persistence snapshots are minified JSON (same data, smaller/faster serialization).
- Workflow runtime keeps bounded history for audits/reconciliation/processed-events and comment history per ticket.

# Files touched
- `apps/api/src/services/orchestration/triage-orchestrator.ts`
- `apps/api/src/lib/event-loop-monitor.ts`
- `apps/api/src/index.ts`
- `apps/api/src/services/context/prepare-context.ts`
- `apps/api/src/services/orchestration/ticket-workflow-core.ts`
- `apps/api/src/services/read-models/runtime-json-file.ts`
- `apps/api/src/services/runtime-json-file.ts`
- `apps/api/src/services/diagnose.ts`
- `apps/api/src/services/evidence-guardrails.ts`
- `apps/api/src/services/p0-ai-triage-assist.ts`
- `apps/api/src/services/p0-manager-ops-visibility.ts`
- `apps/api/src/services/p0-readonly-enrichment.ts`
- `apps/api/src/services/p0-trust-contracts.ts`
- `apps/api/src/services/playbook-writer.ts`
- `apps/api/src/services/prepare-context.ts`
- `apps/api/src/services/validate-policy.ts`
- `apps/api/src/services/email-ingestion-polling.ts`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-03
