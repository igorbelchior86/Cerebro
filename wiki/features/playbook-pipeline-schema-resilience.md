# Playbook Pipeline Schema Resilience
# What changed
- Added runtime schema compatibility checks for `tickets_processed.company` in PrepareContext and processed ticket persistence.
- PrepareContext now falls back to `'' as company` projection when column is absent.
- PgStore now writes with or without `company` column depending on DB capability.
- Added stale-processing recovery in orchestrator: sessions stuck in `processing` for more than 5 minutes are resumed.

# Why it changed
- Playbook generation stopped for newer tickets because PrepareContext failed before evidence generation on DBs missing the new column.

# Impact (UI / logic / data)
- UI: Tickets progress again from context to playbook instead of staying stuck/failed due to missing evidence.
- Logic: Pipeline resilient to partial migration rollout and transient stuck states.
- Data: No migration required for this fix.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/email/pg-store.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/triage-orchestrator.ts

# Date
- 2026-02-20
