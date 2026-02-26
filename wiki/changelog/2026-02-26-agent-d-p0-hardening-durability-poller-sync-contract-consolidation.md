# Title
Agent D P0 Hardening: durability, poller->workflow sync wiring, trust-layer CP0 contract consolidation

# What changed
- `/workflow` now uses a shared runtime singleton with file-backed persistence for P0 workflow state.
- `autotask-polling` now injects polled tickets into workflow sync ingestion (`ticket.created`) and preserves triage orchestration.
- P0 trust store is file-backed and restart-resilient.
- Agent C trust-layer services now use CP0-based trust contracts (audit/AI/correlation) with normalized `trace_id`.
- Reconciliation auditing was expanded (`match`, `mismatch`, `snapshot_missing`, `skipped_fetch_unavailable`).
- Added tests for poller wiring, workflow/trust persistence reload, CP0 conformance, and degraded reconciliation behavior.

# Why it changed
- Improve P0 internal validation stability and remove known fragility/process-loss points.
- Eliminate contract drift risk between Agent C trust layer and CP0 shared contracts.

# Impact (UI / logic / data)
- UI: No new UI feature; workflow inbox/reconciliation runtime survives restart.
- Logic: Poller contributes to workflow sync state and degraded/no-tenant poller mode is explicitly logged.
- Data: Local `.run/p0-workflow-runtime.json` and `.run/p0-trust-store.json` files persist runtime snapshots.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/autotask-polling.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/workflow-runtime.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/ticket-workflow-core.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/p0-trust-store.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/p0-trust-contracts.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/p0-ai-triage-assist.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/p0-readonly-enrichment.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/p0-manager-ops-visibility.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/workflow.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/manager-ops.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/autotask-polling.test.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/p0-trust-store.test.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/ticket-workflow-core.test.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/p0-ai-triage-assist.test.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/p0-manager-ops-visibility.test.ts

# Date
2026-02-26

