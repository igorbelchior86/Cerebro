# Sidebar History Restoration
# What changed
- Updated `/ticket-intake/list` to include both:
  - `tickets_processed` records
  - `triage_sessions` history (with latest `evidence_packs` payload)
- Added merge + dedupe by `ticket_id`.
- Added deterministic newest-first ordering by `created_at`.
- Kept existing response contract consumed by sidebar UI.

# Why it changed
- Sidebar history disappeared because endpoint only read `tickets_processed`, excluding legacy/non-email sessions.

# Impact (UI / logic / data)
- UI: Historical tickets reappear in sidebar.
- Logic: Unified history source across processed email tickets and existing triage sessions.
- Data: No schema changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/ticket-intake.ts

# Date
- 2026-02-20
