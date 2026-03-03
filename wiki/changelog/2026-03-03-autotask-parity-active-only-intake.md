# Title
Autotask parity intake switched to active tickets only

# What changed
- Added `parityActiveOnly` mode to `AutotaskPollingService`.
- Added env/config toggle `AUTOTASK_PARITY_ACTIVE_ONLY` with default `true`.
- In active-only mode, historical parity backfill (`runParityBackfill`) is skipped.
- Poller startup log now includes `parity_active_only` to make runtime mode explicit.
- Added tests validating that backfill is blocked when active-only is enabled and still available when disabled.

# Why it changed
- Full historical parity was scanning multi-year windows and causing very long reconciliation cycles with high provider cost.
- Current operational need is parity for active queue tickets, not complete historical backfill.

# Impact (UI / logic / data)
- UI: faster convergence for active queue parity; less drift from long-running backfill.
- Logic: intake scope is now active tickets by default (queue snapshot + recent polling), not multi-year history.
- Data: historical tickets are no longer auto-ingested by default parity cycle.

# Files touched
- `apps/api/src/services/adapters/autotask-polling.ts`
- `apps/api/src/__tests__/services/autotask-polling.test.ts`
- `tasks/todo.md`

# Date
2026-03-03
