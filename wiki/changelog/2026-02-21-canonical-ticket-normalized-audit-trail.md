# 2026-02-21 Canonical Ticket Normalized + Audit Trail
# What changed
- Backend full-flow response now returns normalized canonical ticket fields and normalization audit metadata.
- Frontend now prioritizes normalized description/requester when building timeline context.

# Why it changed
- Ensure Playbook Brain UI reflects normalized ticket content and not raw intake body.

# Impact (UI / logic / data)
- UI: normalized content visible in triage flow.
- Logic: unchanged enrichment pipeline.
- Data: canonical response enriched with audit trail metadata.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/playbook.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `/Users/igorbelchior/Documents/Github/Cerebro/wiki/features/canonical-ticket-normalized-with-audit-trail.md`

# Date
- 2026-02-21
