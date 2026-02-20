# Changelog: Playbook Generation Resume Fix
# What changed
- Fixed pipeline blocker caused by missing `tickets_processed.company` in some DBs.
- Added compatibility guards in PrepareContext and ticket persistence.
- Added recovery for stale `processing` sessions.

# Why it changed
- Prevent complete pipeline halt (no evidence -> no diagnosis -> no playbook).

# Impact (UI / logic / data)
- UI: Playbook generation can resume for affected tickets.
- Logic: More robust orchestrator and schema-tolerant pipeline stages.
- Data: No schema change required.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/email/pg-store.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/triage-orchestrator.ts

# Date
- 2026-02-20
