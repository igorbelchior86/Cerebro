# Restore Autotask Default Suggestion Lists
# What changed
- Restored default suggestion loading for typed Autotask selectors (`Org`, `Primary`, `Secondary`, and ticket `Tech`) using cheap blank-query prefetches plus cached local suggestions.
- Re-enabled backend support for blank-query suggestion requests on company and resource selectors, but with low-latency bounded filters instead of broad global scans.
- Removed the UI-only “type 2 characters first” waiting state so selectors can render initial suggestions immediately and still refine after the first character.
- Confirmed `Contact` and `Additional contacts` remain pre-warmed by company-scoped contact caches, and added proactive warm-up for ticket picklists (`Issue Type`, `Sub-Issue Type`, `Priority`, `Service Level Agreement`) on the ticket detail page.

# Why it changed
- The previous low-latency refactor prevented blank-query fetches and short-circuited the frontend before any default suggestions could populate, leaving the modal empty on open.
- The known-good baseline from commit `ddd3a5c6847f877d4af6cf35944a34117cd8ff4d` showed that these selectors were expected to open with an initial list.
- The updated implementation preserves that UX contract while keeping the read path bounded and cache-friendly.

# Impact (UI / logic / data)
- UI: `Org`, `Primary`, `Secondary`, `Contact`, `Additional contacts`, `Issue Type`, `Sub-Issue Type`, `Priority`, and `Service Level Agreement` now have an initial suggestion path instead of relying on a cold modal state.
- Logic: company/resource blank-query requests now return bounded active-option lists; frontend preloads and reuses those lists as local cache, and the ticket detail page proactively warms editable picklists before the modal opens.
- Data: no schema change, no persistence change, no write-path change.

# Files touched
- `apps/api/src/routes/autotask.ts`
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/lessons.md`
- `tasks/todo.md`

# Date
- 2026-03-01
