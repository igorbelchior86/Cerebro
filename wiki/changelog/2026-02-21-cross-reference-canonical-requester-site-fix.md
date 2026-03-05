# Cross-reference Canonical Requester/Site Fix
# What changed
- Backend `/ticket-intake/list` now:
  - prioritizes canonical requester from iterative enrichment,
  - computes `site` independently,
  - removes `site: requester` mapping.
- Frontend triage page now prefers canonical `ticket` fields from `/playbook/full-flow` for requester/company before using sidebar list fallback.

# Why it changed
- Ticket T20260220.0018 showed a cross-reference inconsistency: normalized user was correct in pipeline, but sidebar/context consumed non-canonical fields.

# Impact (UI / logic / data)
- UI: sidebar and right context show consistent requester/site values.
- Logic: improved source precedence for identity/site rendering.
- Data: no migration required.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/ticket-intake.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/features/cross-reference-canonical-requester-site-fix.md

# Date
- 2026-02-21
