# Autotask Search Suggestions Restored With Local Cache

# What changed
- Kept the backend minimum-query guard for `/autotask/companies/search` and `/autotask/resources/search`, so blank queries still do not hit the provider.
- Restored immediate suggestions in the Org/Tech edit modals by serving local suggestions from the current selected value plus an in-memory cache of the last successful search results in the same page session.
- Updated the empty-search modal state so users still see suggestions when available instead of a blank list.

# Why it changed
- The first performance fix removed the expensive blank-query provider call, but it also removed the suggestion list users expected on modal open.
- The correct fix needed to preserve the UX contract (suggestions on open) without reintroducing the high-cost Autotask global search.

# Impact (UI / logic / data)
- UI: The modal can open with immediate local suggestions again.
- Logic: Remote Autotask search still only runs for typed queries (2+ characters), while suggestions on empty query come from local session state.
- Data: No persistence, schema, or tenant-scoping changes.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-01
