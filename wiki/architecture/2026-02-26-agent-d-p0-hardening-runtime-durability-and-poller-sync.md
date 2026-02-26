# Title
Agent D P0 Hardening Runtime Durability + Poller Workflow Sync Wiring

# What changed
- Consolidated workflow runtime composition into a shared singleton module (`workflow-runtime`) used by `/workflow` routes and `autotask-polling`.
- Enabled file-backed persistence for P0 workflow runtime state (`commands`, `audits`, `processed sync events`, `inbox`, `reconciliation issues`) via JSON snapshot persistence.
- Enabled file-backed persistence for P0 trust store state (`audit records`, `AI decision records`) via JSON snapshot persistence.
- Wired Autotask poller ingestion into `TicketWorkflowCoreService.processAutotaskSyncEvent(...)` before existing triage pipeline execution.

# Why it changed
- `/workflow` and the poller previously operated on isolated runtime paths, preventing poller-discovered tickets from feeding the new P0 workflow sync ingestion path.
- Critical P0 runtime state was process-fragile (in-memory only), reducing internal validation reliability.

# Impact (UI / logic / data)
- UI: No direct UI feature change; `/workflow` inbox/reconciliation state now survives process restarts (file-backed runtime).
- Logic: Poller now emits Autotask `ticket.created` sync events into the workflow core when tenant context is available.
- Data: Runtime state is persisted to local `.run/*.json` files (bounded local operational persistence, no DB migration).

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/workflow-runtime.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/workflow.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/autotask-polling.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/ticket-workflow-core.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/runtime-json-file.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/p0-trust-store.ts

# Date
2026-02-26

