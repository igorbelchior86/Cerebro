# New Ticket Primary Tech Spinner Loop Fix
# What changed
- Updated `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx` to avoid redundant `searchSuggestionCache` writes inside the context editor effect.
- Added helper `areSameContextOptions` to compare cached option arrays by `id`, `label`, and `sublabel`.
- Wrapped cache writes for `Org` and `Primary/Secondary` suggestion hydration with no-op guards when merged output is unchanged.

# Why it changed
- The context editor effect depended on `searchSuggestionCache` and also mutated it on each resource search.
- In the `Primary` empty-query hydration path, this created a re-render/effect loop that kept `contextEditorLoading` cycling as "Searching Autotask...".

# Impact (UI / logic / data)
- UI: Primary tech selector in New Ticket now stabilizes and shows options instead of spinning indefinitely.
- Logic: Effect remains reactive but state writes are idempotent for unchanged suggestion sets.
- Data: No schema or persistence changes.

# Files touched
- apps/web/src/app/[locale]/(chat)/triage/home/page.tsx

# Date
- 2026-03-02
