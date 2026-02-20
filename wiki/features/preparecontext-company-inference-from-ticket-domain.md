# PrepareContext Company Inference From Ticket Domain
# What changed
- Added fallback company inference in `PrepareContextService` when `ticket.company` is unavailable.
- Inference source:
  - email domain extracted from ticket text (`description/requester/title`)
  - domain root normalization with business-suffix split (ex: `stintinomanagement.com` -> `Stintino Management`)
- Pipeline now uses inferred company name for IT Glue/Ninja org resolution.

# Why it changed
- Some environments do not have `tickets_processed.company` persisted, while UI already displays organization from parsed ticket text.
- This mismatch caused `org match: none` in evidence pack despite visible company signal in sidebar.

# Impact (UI / logic / data)
- UI: no direct UI change.
- Logic: backend now reuses available ticket identity signal to resolve org scope instead of dropping to `unknown`.
- Data: no schema change; richer `evidence_pack.org` and source findings.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts

# Date
- 2026-02-20
