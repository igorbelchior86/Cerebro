# Sidebar Suppressed Inline Filter Toggle
# What changed
- Added a default-on suppressed-ticket visibility toggle in the left sidebar filter area (`ALL / PROCESSING / DONE / FAILED`).
- Sidebar now hides tickets flagged as `suppressed` by default and shows them inline when the toggle is turned off.
- Suppressed tickets rendered inline show a `SUPPRESSED` badge, reason label, and heuristic confidence.
- Added local persistence (`localStorage`) for the suppressed visibility toggle state.
- Added conservative heuristic suppression metadata (`suppressed`, reason, confidence) to `/email-ingestion/list` for obvious intake noise (`bounce`, `quarantine digest`, `marketing`).

# Why it changed
- The ticket queue needs a safe way to reduce visual noise and future API waste without deleting items.
- `Suppress > Delete` requires suppressed items to remain auditable and recoverable in the same list context.
- A list-level filter toggle keeps a single queue mental model while hiding non-actionable noise by default.

# Impact (UI / logic / data)
- UI: New filter toggle button in the sidebar tabs row; suppressed items are hidden by default and can be shown inline.
- Logic: Sidebar filtering now applies both status filter and suppressed visibility filter.
- Data: `/email-ingestion/list` returns transient suppression metadata (heuristic v1) for obvious noise patterns only.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatSidebar.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/messages/en.json
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/email-ingestion.ts

# Date
2026-02-24
