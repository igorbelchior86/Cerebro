# Sidebar Ticket Data Quality Hardening
# What changed
- Updated `/email-ingestion/list` merge logic to drop failed session stubs that have neither parsed ticket data nor evidence payload.
- Added quality-based precedence when merging session + processed ticket fields:
  - prefer processed title/requester/company when available
  - fallback to sanitized evidence payload fields
  - fallback to safe defaults only last
- Added sanitization helpers in list route to normalize HTML/encoded fields.
- Expanded requester extraction fallback to support `Created on ... by ...` format.

# Why it changed
- New cards were appearing as `Untitled Ticket` + `Unknown ...` due to failed stubs and poor source precedence in merged list data.

# Impact (UI / logic / data)
- UI: Sidebar cards now show meaningful values for recent tickets and suppress empty failed placeholders.
- Logic: Read model now selects the best available source per field.
- Data: No schema changes; backward compatible.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/email-ingestion.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/email/email-parser.ts

# Date
- 2026-02-20
