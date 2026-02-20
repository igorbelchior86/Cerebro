# Email Description Noise Cleaning
# What changed
- Implemented `cleanDescription` pipeline in email parser to remove non-problem text from ticket descriptions.
- Added cleanup stages for:
  - HTML/script/style stripping and entity decoding
  - Reply/forward block trimming (`On ... wrote:`, `From:`, `Original Message`, forwarded markers)
  - Footer/disclaimer trimming (confidentiality/legal/automated footers)
  - Common sign-off tail removal (`Best regards`, `Thanks`, `Sent from my ...`)
  - Whitespace normalization
- Added safety fallback to preserve normalized original content when cleanup over-prunes text.

# Why it changed
- Ticket descriptions were still polluted with signatures, disclaimers, and email thread residue, hurting middle-column readability and context quality.

# Impact (UI / logic / data)
- UI: Cleaner problem narrative in timeline item 1 and other description consumers.
- Logic: Description cleaning now happens at ingestion parser layer with deterministic rules.
- Data: New ingested/updated processed ticket descriptions are cleaner.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/email/email-parser.ts

# Date
- 2026-02-20
