# Autotask Suggestion Latency Mitigation
# What changed
- Added a short-lived in-memory cache (30s TTL) for read-only Autotask suggestion routes used by company, contact, and resource selectors.
- Warmed contact suggestions per company in the `New Ticket` and ticket detail UIs so `Contact` and `Additional contacts` can open with local suggestions before a new provider round-trip.
- Replaced the ticket detail page's sequential picklist hydration for `Priority`, `Issue Type`, `Sub-Issue Type`, and `Service Level Agreement` with a single aggregated `ticket-field-options` fetch.

# Why it changed
- Suggestion latency was dominated by repeated Autotask round-trips during modal open and repeated searches.
- The current UX needed to feel closer to native Autotask behavior for the primary ticket metadata fields, especially when operators open selectors repeatedly in the same session.
- Context7 guidance from the official Autotask wrapper docs reinforced structured, scoped queries instead of repeated broad fetches; this change reduces repeated fetch pressure without changing write semantics.

# Impact (UI / logic / data)
- UI: `Contact` and `Additional contacts` selectors now render immediate local suggestions when a company is already known; the ticket detail page resolves the four ticket picklists faster because it hydrates them in one call.
- Logic: backend read-only search routes now reuse recent results for identical query inputs; ticket detail metadata hydration now batches picklist loading.
- Data: no schema change, no persistence change, no write-path change.

# Files touched
- `apps/api/src/routes/autotask.ts`
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`

# Date
- 2026-03-01
