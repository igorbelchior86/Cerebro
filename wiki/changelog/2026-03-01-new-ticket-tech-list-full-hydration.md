# New Ticket Tech List Full Hydration
# What changed
- Updated the new-ticket tech selector so `Primary` and `Secondary` open with the cached quick suggestions immediately, but still continue loading the full bounded technician list in the background when the query is empty.
- Increased the empty-query technician fetch in the new-ticket editor from the small default list to a bounded `100`-record hydration pass.
- Updated the read-only Autotask resource search route to query a larger bounded upstream result set when a text search is present, then apply the existing local filter and return only the requested UI limit.

# Why it changed
- The new-ticket modal was short-circuiting on the local cache of 8 suggestions, so the selector often never loaded beyond that initial subset.
- The backend resource search only fetched the first limited provider page and then filtered locally, which hid valid technicians outside that first slice.

# Impact (UI / logic / data)
- UI: opening `Primary` or `Secondary` in the new-ticket flow now expands from the quick suggestion cache into a fuller technician list instead of staying capped at the first 8 cached entries.
- Logic: resource searches now inspect a broader bounded upstream candidate set before applying local name/email filtering, reducing false omissions in technician search results.
- Data: no schema change, no migration, no write-path change.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `apps/api/src/routes/autotask.ts`
- `tasks/todo.md`

# Date
- 2026-03-01
