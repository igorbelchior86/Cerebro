# Lint Warning Reduction Round 2 Heavy API Hotspots
# What changed
- Reduced the API lint warning baseline from `1251` to `808`.
- Finished the JSON typing cleanup in `apps/api/src/services/context/enrichment-cache.ts`, removing the remaining warning cluster there.
- Removed the full warning cluster from `apps/api/src/services/orchestration/ticket-workflow-core.ts` by replacing `any`-based snapshot handling with explicit JSON record helpers and removing dead code.
- Removed the full warning cluster from `apps/api/src/services/adapters/autotask-polling.ts` by typing ticket payload reads, optional Autotask client capabilities, and retry/error handling.
- Removed the full warning cluster from `apps/api/src/__tests__/services/autotask-polling.test.ts` by replacing `any`-based mocks/spies with explicit test helpers and typed casts.
- Preserved the earlier `prepare-context.ts` cleanup and carried it forward as part of the new baseline.

# Why it changed
- The remaining API lint warnings were concentrated in a few large files that used loose `any` access patterns.
- Cleaning those hotspots first gives the biggest warning reduction with the lowest behavior risk, because the work is mostly typing and dead-code cleanup rather than business-rule changes.
- The test file cleanup keeps the suite aligned with the same lint standard as runtime code, which makes future warning hunts easier.

# Impact (UI / logic / data)
- UI: no direct UI impact.
- Logic: no intended behavior change; the work is limited to safer typing, helper-based record access, and removal of unused code.
- Data: no schema or stored-data changes.

# Files touched
- `apps/api/src/services/context/enrichment-cache.ts`
- `apps/api/src/services/context/prepare-context.ts`
- `apps/api/src/services/orchestration/ticket-workflow-core.ts`
- `apps/api/src/services/adapters/autotask-polling.ts`
- `apps/api/src/__tests__/services/autotask-polling.test.ts`
- `tasks/todo.md`

# Date
- 2026-03-06
