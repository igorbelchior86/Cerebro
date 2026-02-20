# Sidebar Session-only Raw Fallback
# What changed
- Added fallback enrichment from `tickets_raw` for session records that do not yet have `tickets_processed` or evidence payload fields.
- Added title precedence fix to use `rawFallback.title` before defaulting to sanitized pack/fallback.

# Why it changed
- Valid tickets like `T20260220.0012` were being hidden/flattened because they existed only as failed session stubs at list time.

# Impact (UI / logic / data)
- UI: Valid session-only tickets now show real title/requester/company in sidebar.
- Logic: List API can derive card fields from raw inbox data when pipeline artifacts are missing.
- Data: No schema changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/email-ingestion.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/email/email-parser.ts

# Date
- 2026-02-20
