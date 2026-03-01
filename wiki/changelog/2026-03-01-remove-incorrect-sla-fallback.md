# Remove Incorrect SLA Fallback
# What changed
- Removed the frontend fallback that auto-selected the first active `serviceLevelAgreement` option in `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`.
- Removed the backend fallback that auto-selected the first active `serviceLevelAgreementID` in `apps/api/src/clients/autotask.ts`.
- Kept the `queue` fallback unchanged.

# Why it changed
- The wrong SLA (`Enhanced`) was coming from an internal heuristic, not from an authoritative Autotask default.
- Because picklist options are sorted alphabetically, selecting the first active SLA was producing an arbitrary business value.

# Impact (UI / logic / data)
- UI: the New Ticket draft will no longer auto-fill SLA with a fabricated value when no confirmed default is available.
- Logic: SLA prefill now requires an explicit/default source (`isDefault`, category defaults, or equivalent) instead of list position.
- Data: ticket create payload will stop sending a wrong `serviceLevelAgreementID` derived only from picklist ordering.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `apps/api/src/clients/autotask.ts`
- `tasks/todo.md`
- `tasks/lessons.md`
- `wiki/changelog/2026-03-01-remove-incorrect-sla-fallback.md`

# Date
- 2026-03-01
