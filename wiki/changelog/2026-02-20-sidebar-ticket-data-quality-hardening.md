# Changelog: Sidebar Ticket Data Quality Hardening
# What changed
- Filtered out empty failed session placeholders in sidebar list endpoint.
- Added field-quality precedence for merged session/processed ticket records.
- Added fallback requester parsing for `Created on ... by ...` template.

# Why it changed
- Prevent `Untitled/Unknown` regressions in newly displayed ticket cards.

# Impact (UI / logic / data)
- UI: Ticket cards now display clean title/requester/company more consistently.
- Logic: Stronger normalization and source-selection policy in list API.
- Data: No migration required.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/ticket-intake.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/email/email-parser.ts

# Date
- 2026-02-20
