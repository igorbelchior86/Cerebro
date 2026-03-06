# Lint Warning Reduction Round 3: Context And P0 Cleanup
# What changed
- Removed `any`-heavy code paths from the API context pipeline in `fusion-engine.ts`, `prepare-context-helpers.ts`, and `history-resolver.ts`.
- Replaced loose JSON access with explicit record helpers and typed inputs for fusion, enrichment, and history refinement.
- Simplified `services/ai/p0-readonly-enrichment.ts` into a thin re-export and cleaned `services/p0-readonly-enrichment.ts` so the P0 read-only implementation no longer duplicates unsafe `any` access.
- Aligned the P0 trust-store type import to the `domain/*` path so the shared implementation keeps one consistent store type.

# Why it changed
- These files were among the biggest remaining low-risk lint hotspots in the API.
- Most warnings came from `@typescript-eslint/no-explicit-any`, especially around JSON payload parsing and helper boundaries.
- Cleaning them reduces noise, makes real issues easier to see, and keeps the code safer without changing business behavior.

# Impact (UI / logic / data)
- UI: none.
- Logic: no intended behavior change; this was a type-safety and duplication cleanup.
- Data: none; stored payloads and runtime contracts were preserved.
- Tooling: API lint warnings dropped from `808` to `654` in this round.

# Files touched
- `apps/api/src/services/orchestration/fusion-engine.ts`
- `apps/api/src/services/context/prepare-context-helpers.ts`
- `apps/api/src/services/p0-readonly-enrichment.ts`
- `apps/api/src/services/ai/p0-readonly-enrichment.ts`
- `apps/api/src/services/context/history-resolver.ts`
- `tasks/todo.md`

# Date
- 2026-03-06
