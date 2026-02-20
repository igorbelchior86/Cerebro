# Changelog: Sidebar History Restored
# What changed
- `/email-ingestion/list` now merges historical data from `triage_sessions`/`evidence_packs` with `tickets_processed`.
- Added dedupe by ticket ID and chronological sorting.

# Why it changed
- Prevent regression where sidebar appeared empty or missing most historical tickets.

# Impact (UI / logic / data)
- UI: Previous ticket history is visible again.
- Logic: List endpoint is no longer tied to only one ingestion table.
- Data: No migration required.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/email-ingestion.ts

# Date
- 2026-02-20
