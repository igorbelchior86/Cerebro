# Canonical Ticket Normalized with Audit Trail
# What changed
- Updated backend `GET /playbook/full-flow` canonical ticket payload to include normalized fields from iterative enrichment Round 0.
- Added normalized fields:
- `description_normalized`
- `requester_normalized`
- `requester_email_normalized`
- `affected_user_normalized`
- `affected_user_email_normalized`
- Added `normalization_audit` object with round/method/confidence/source extracted from `source_findings`.
- Updated frontend triage page to prioritize normalized ticket description and normalized requester in timeline rendering.

# Why it changed
- UI was still displaying raw `tickets_processed.description` instead of normalized Round 0 output.
- Needed canonical backend response with explicit auditability for normalization provenance.

# Impact (UI / logic / data)
- UI: now shows normalized text as primary ticket narrative.
- Logic: no pipeline logic change; presentation layer now aligned with normalized canonical data.
- Data: API response includes normalization provenance for traceability.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/playbook.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`

# Date
- 2026-02-21
