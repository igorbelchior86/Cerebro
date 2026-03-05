# Changelog: Session-only Ticket Fallback
# What changed
- `/ticket-intake/list` now enriches missing session-only ticket cards from `tickets_raw`.
- Fixed title precedence bug to include raw fallback title.

# Why it changed
- Prevent valid tickets from appearing as `Untitled` or disappearing when only session rows exist.

# Impact (UI / logic / data)
- UI: Better integrity for fresh tickets in transient pipeline-failure states.
- Logic: More robust merge strategy across processed/session/raw sources.
- Data: No migration.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/ticket-intake.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/email/email-parser.ts

# Date
- 2026-02-20
