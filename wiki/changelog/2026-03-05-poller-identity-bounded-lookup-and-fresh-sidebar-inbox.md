# Poller Identity Lookup Bounded + Fresh Sidebar Inbox Polling
# What changed
- Bounded Autotask identity lookup in poller (`apps/api/src/services/adapters/autotask-polling.ts`):
  - per-call timeout,
  - per-run lookup budget,
  - max company/contact IDs per run,
  - bounded concurrency,
  - degraded observability log when budget/caps are hit.
- Added regression test (`apps/api/src/__tests__/services/autotask-polling.test.ts`) proving slow company/contact lookup does not block workflow sync ingestion.
- Changed sidebar periodic polling to force fresh `/workflow/inbox` reads during interval loops:
  - `apps/web/src/lib/p0-ui-client.ts`
  - `apps/web/src/lib/workflow-sidebar-adapter.ts`
  - `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
  - `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`

# Why it changed
- Incident: Flow A hydration appeared broken and "show" stayed stale (counter/cards not moving) for long periods.
- Root causes:
  - Poller critical path could stall on N+1 identity lookups under provider slowness/rate-limits.
  - Sidebar loop reused stale read path behavior instead of forcing fresh inbox fetch per cycle.

# Impact (UI / logic / data)
- UI: sidebar counter/cards update from fresh inbox reads on each polling interval.
- Logic: sync ingestion is no longer blocked by slow identity enrichment lookups.
- Data: no schema or migration changes.

# Files touched
- `apps/api/src/services/adapters/autotask-polling.ts`
- `apps/api/src/__tests__/services/autotask-polling.test.ts`
- `apps/web/src/lib/p0-ui-client.ts`
- `apps/web/src/lib/workflow-sidebar-adapter.ts`
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-05
