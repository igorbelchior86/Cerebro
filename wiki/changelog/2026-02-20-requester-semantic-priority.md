# Changelog: Requester Semantic Priority
# What changed
- Requester extraction now prioritizes affected user narrative markers over creator metadata.

# Why it changed
- Fix incorrect requester display (e.g., `Carolyn` instead of `Jason`).

# Impact (UI / logic / data)
- UI: More accurate requester identity in sidebar cards.
- Logic: Improved parsing precedence for email templates.
- Data: No migration.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/email/email-parser.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/email-ingestion.ts

# Date
- 2026-02-20
