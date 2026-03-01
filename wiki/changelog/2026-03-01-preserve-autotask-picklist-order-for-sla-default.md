# Preserve Autotask Picklist Order For SLA Default
# What changed
- Removed alphabetical sorting from `getTicketFieldPicklist` in `apps/api/src/clients/autotask.ts`, preserving the original picklist order returned by Autotask.
- Restored the SLA fallback in `apps/api/src/clients/autotask.ts` and `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx` to use the first active item in provider order.
- Discarded the temporary hardcoded label fallback so the behavior remains tenant-agnostic.

# Why it changed
- The wrong SLA (`Enhanced`) was caused by local alphabetical sorting, which changed the provider’s original ordering before the fallback logic selected the first item.
- To mirror the Autotask UI generically, the Cerebro must preserve provider ordering instead of substituting its own display ordering.

# Impact (UI / logic / data)
- UI: the New Ticket draft can now mirror the SLA default using the original Autotask picklist order rather than an alphabetically reordered list.
- Logic: default derivation is now based on provider order, not local label sorting.
- Data: the selected `serviceLevelAgreementID` now follows the provider’s exposed ordering signal, reducing mismatch with the Autotask form.

# Files touched
- `apps/api/src/clients/autotask.ts`
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`
- `wiki/changelog/2026-03-01-preserve-autotask-picklist-order-for-sla-default.md`

# Date
- 2026-03-01
