# Autotask Search Modal Minimum Query Guard

# What changed
- Added a minimum-query guard to the read-only Autotask search endpoints for companies and resources: blank or 1-character queries now return an empty result immediately instead of calling the provider.
- Updated the frontend context editors in `triage/home` and `triage/[id]` so the Org/Tech global-search modals wait for at least 2 typed characters before starting the remote fetch.
- Updated the modal empty state to show a search hint instead of pretending the provider returned no matches before the user types enough input.

# Why it changed
- The Org and Primary edit modals were opening already in `Searching Autotask...` before the first keystroke.
- That blank-query preload translated into expensive global provider searches, which increased latency and could fail under Autotask throttling, surfacing as `Failed to fetch`.

# Impact (UI / logic / data)
- UI: Org/Primary search modals no longer start with a long spinner on open; they wait for the user to type at least 2 characters.
- Logic: Global search requests for Autotask companies/resources are now bounded and deterministic instead of issuing broad empty searches.
- Data: No persistence, schema, or tenant-scoping behavior changed.

# Files touched
- `apps/api/src/routes/autotask.ts`
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-01
