# Requester Semantic Priority
# What changed
- Updated requester extraction to prefer the affected/requested-for user over ticket creator metadata.
- New precedence:
  - `request from <Name>:`
  - salutation (`<Name>,`)
  - `Created by` / `Created on ... by ...`
- Applied in both:
  - ingestion parser (new records)
  - `/ticket-intake/list` raw fallback (existing records)

# Why it changed
- Tickets can be created by dispatcher/admin on behalf of another user. Sidebar should show the real user context.

# Impact (UI / logic / data)
- UI: Requester now better reflects actual affected user.
- Logic: Semantic extraction aligned with operational meaning.
- Data: No schema changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/email/email-parser.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/ticket-intake.ts

# Date
- 2026-02-20
