# Stop Autotask Ticket Field Options Storm

# What changed
- Stabilized `usePollingResource` so polling effects no longer restart every render when callers pass a new `fetcher` function identity.
- Turned `loadCachedReadOnlyArray()` into a real TTL cache for ticket field option catalogs, returning fresh cached data before re-hitting Autotask and falling back to stale data on provider failure.
- Memoized `getEntityFields()` inside each `AutotaskClient` instance so repeated reads of `/tickets/entityInformation/fields` collapse into a single upstream request per request scope.

# Why it changed
- The local UI was repeatedly re-fetching polling resources because inline lambdas recreated the `fetcher` dependency on every render.
- Each local hit to `/autotask/ticket-field-options` fanned out into repeated metadata reads upstream, which was enough to exhaust the Autotask rate limit from the local environment alone.
- The fix needed to cut both the frontend request storm and the backend metadata fan-out without changing integration semantics.

# Impact (UI / logic / data)
- UI: polling resources keep using the latest fetcher logic without forcing an immediate refetch on every render.
- Logic: ticket field option routes now reuse cached catalogs for 30 seconds and degrade from stale cache instead of always calling the provider first.
- Data: no schema, storage, or persisted data changes.

# Files touched
- `apps/web/src/hooks/usePollingResource.ts`
- `apps/api/src/routes/autotask.ts`
- `apps/api/src/clients/autotask.ts`
- `tasks/todo.md`

# Date
- 2026-03-01
