# Sidebar List Schema Compatibility
# What changed
- Updated `/email-ingestion/list` to detect whether `tickets_processed.company` exists before selecting it.
- Added fallback projection (`'' AS company`) when column is absent.
- Preserved merged history behavior (`tickets_processed` + `triage_sessions`/`evidence_packs`).

# Why it changed
- In environments without the latest migration, the list query failed and the sidebar appeared empty.

# Impact (UI / logic / data)
- UI: Sidebar no longer goes empty due to SQL failure from schema drift.
- Logic: Backward-compatible read path across DB versions.
- Data: No new migration required for this fix.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/email-ingestion.ts

# Date
- 2026-02-20
