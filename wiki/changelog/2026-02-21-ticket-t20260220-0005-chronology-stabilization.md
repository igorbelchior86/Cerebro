# Ticket T20260220.0005 Chronology Stabilization
# What changed
- Updated `/ticket-intake/list` to compute a canonical timeline per ticket:
- `created_at` for sidebar cards now uses `tickets_processed.created_at`, with fallback to the first `triage_sessions.created_at` for that ticket.
- Removed mutable timestamp sources from card chronology (`session_updated_at`, `pack.ticket.created_at`) in sidebar ordering payload.

# Why it changed
- Ticket `T20260220.0005` continued to jump in sidebar chronology between polls because mutable timestamps changed during pipeline updates/retries.

# Impact (UI / logic / data)
- UI: Card position in sidebar remains stable over time for the same ticket.
- Logic: List ordering is now based on immutable per-ticket chronology.
- Data: No schema changes; query assembly logic only.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/ticket-intake.ts
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/features/pipeline-only-ticket-flow-stabilization.md

# Date
- 2026-02-21
