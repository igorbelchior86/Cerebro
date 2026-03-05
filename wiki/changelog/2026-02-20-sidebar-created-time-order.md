# Sidebar Ticket Created Time + Chronological Order
# What changed
- Updated email parsing and persistence so each processed ticket stores the ticket creation timestamp instead of ingestion timestamp.
- Email parser now resolves ticket `createdAt` with this fallback chain:
  1) parsed from email body (`Created ...:`)
  2) Microsoft Graph `receivedDateTime`
  3) current timestamp as last-resort fallback.
- Updated ticket list queries and backfill ordering to sort by `created_at DESC` (most recent first).

# Why it changed
- Sidebar card time under each ticket needed to show ticket creation time, not import time.
- Sidebar ordering had to be chronological with newest ticket first.

# Impact (UI / logic / data)
- UI: The time shown on each sidebar card now reflects ticket creation provenance from ingestion pipeline.
- Logic: Creation timestamp extraction became deterministic with explicit fallback strategy.
- Data: `tickets_processed.created_at` is now explicitly written from parsed ticket creation time on insert/upsert.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/email/email-parser.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/email/pg-store.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/ticket-intake.ts

# Date
- 2026-02-20
