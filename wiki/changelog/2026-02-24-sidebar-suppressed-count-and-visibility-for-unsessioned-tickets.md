# 2026-02-24 Sidebar Suppressed Count And Visibility For Unsessioned Tickets
# What changed
- Fixed `/email-ingestion/list` so the sidebar list is anchored on `tickets_processed` (inbox source of truth) instead of `triage_sessions`.
- `triage_sessions`, `evidence_packs`, and `ticket_ssot` are now optional joins for enrichment/status display.
- Manually suppressed tickets with no triage session now reappear when the "hide suppressed" filter is turned off.
- Suppressed ticket count now includes manually suppressed tickets that have not entered the pipeline yet.

# Why it changed
- Manual suppression can happen before any pipeline/session exists.
- The previous query excluded tickets without `triage_sessions`, so the UI filter toggle and suppressed counter became inconsistent with the actual suppressed state.

# Impact (UI / logic / data)
- UI: Toggling the suppressed filter off now correctly reveals manually suppressed tickets even if they were never processed.
- Logic: Sidebar list semantics now match inbox semantics (`tickets_processed` first).
- Data: No schema changes in this fix; query-only correction.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/email-ingestion.ts
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md

# Date
- 2026-02-24
