# Changelog: SSOT Company Domain Fallback Override Fix
# What changed
- Fixed `PrepareContext` so domain-derived `ticket.company` fallbacks no longer override better inferred company names in SSOT.
- Added a minimal domain-fallback heuristic and applied it in both:
- initial `companyName` selection (intake vs inferred)
- SSOT anti-regression company preservation logic

# Why it changed
- The interface still displayed a domain-style company string instead of the real company name because SSOT assembly preserved the degraded intake fallback.

# Impact (UI / logic / data)
- UI: Company display uses improved SSOT company values after reprocessing.
- Logic: Anti-regression now protects true intake company formatting without freezing domain-derived fallback strings.
- Data: `ticket_ssot.payload.company` is corrected on subsequent pipeline runs.

# Files touched
- `apps/api/src/services/prepare-context.ts`
- `wiki/features/ssot-company-domain-fallback-override-fix.md`

# Date
- 2026-02-24

