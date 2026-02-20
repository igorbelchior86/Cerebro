# Changelog: Company Inference For Org Match
# What changed
- Implemented company-name inference from ticket email domain when `ticket.company` is missing.
- Reprocessed `T20260220.0017` and verified:
  - `evidence_pack.org = Stintino Management`
  - IT Glue `org match` succeeded (`9260822`)
  - contacts/passwords were collected.

# Why it changed
- Backend pipeline was ignoring organization signal already visible in UI when DB schema lacked `company` column.

# Impact (UI / logic / data)
- UI: unchanged.
- Logic: improves org resolution reliability for email-ingested tickets.
- Data: no migration required.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts

# Date
- 2026-02-20
