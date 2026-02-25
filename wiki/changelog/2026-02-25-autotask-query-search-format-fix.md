# Autotask Query Search Format Fix
# What changed
- Fixed `AutotaskClient.searchTickets()` to send the `search` query parameter in the documented Autotask REST format: `{"MaxRecords":N,"filter":[...]}`.
- Removed legacy `pageSize`/`pageNumber` query params from the `/tickets/query` request path and now encode record limit via `MaxRecords` in `search`.
- Added a unit test to verify the generated `search` payload format for ticket queries.

# Why it changed
- The app was authenticating to Autotask successfully, but ticket search requests were failing because the poller/client sent a non-documented query shape (`search={op,field,value}` without the `filter[]` wrapper).
- This caused Autotask `/tickets/query` calls to fail even though the UI showed the integration as connected.

# Impact (UI / logic / data)
- UI: No visual changes.
- Logic: Autotask polling/search requests now use a query format compatible with the documented REST API.
- Data: No schema changes; enables successful reads from Autotask ticket query endpoint.

# Files touched
- `apps/api/src/clients/autotask.ts`
- `apps/api/src/__tests__/clients/autotask.test.ts`
- `tasks/todo.md`
- `tasks/lessons.md`
- `wiki/changelog/2026-02-25-autotask-query-search-format-fix.md`

# Date
- 2026-02-25
