# Sidebar list includes Autotask triage sessions
# What changed
Updated `/email-ingestion/list` query in the API to build the sidebar dataset from a union of `tickets_processed.id` and `triage_sessions.ticket_id` (`ticket_keys` CTE), instead of anchoring only on `tickets_processed`.

This keeps the existing UI payload format while allowing Autotask-only tickets (created by the Autotask poller and stored in `triage_sessions`/`ticket_ssot`) to appear in the Cerebro sidebar.

# Why it changed
After moving intake to Autotask-only, new tickets were being processed by the orchestrator but not appearing in the UI list because the sidebar endpoint still listed only records present in `tickets_processed` (legacy/email-backed list source).

# Impact (UI / logic / data)
- UI: Sidebar list (`/email-ingestion/list`) now shows recent Autotask tickets even when there is no `tickets_processed` row.
- Logic: No change to pollers or orchestration; only the list query source set was expanded.
- Data: No migration/data rewrite. Existing tables are reused (`triage_sessions`, `evidence_packs`, `ticket_ssot`, `tickets_processed`).

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/email-ingestion.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`

# Date
2026-02-25
