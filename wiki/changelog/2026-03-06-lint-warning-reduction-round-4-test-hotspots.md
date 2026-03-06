# Lint Warning Reduction Round 4: Test Hotspots
# What changed
- Cleaned a focused batch of old API tests that were still using `any`-based mocks and direct unsafe casts.
- Replaced broad `as any` test access with small local interfaces, `unknown` bridges, typed helper factories, and `satisfies` where useful.
- Normalized several test doubles around Prepare Context, Autotask workflow gateway, triage orchestrator, policy gates, background interval coverage, and read-model credential fetchers.

# Why it changed
- The remaining warnings were heavily concentrated in tests, which offered the best warning reduction with the lowest runtime risk.
- Reducing test noise first makes the next real hotspots easier to see and keeps the cleanup work incremental and safe.

# Impact (UI / logic / data)
- UI: none.
- Logic: no intended runtime behavior change; only test typing and mock structure changed.
- Data: none.
- Tooling: API lint warnings dropped from `654` to `598` in this round.

# Files touched
- `apps/api/src/__tests__/services/prepare-context-device-resolution.test.ts`
- `apps/api/src/__tests__/services/autotask-ticket-workflow-gateway.test.ts`
- `apps/api/src/__tests__/services/triage-orchestrator-tenant.test.ts`
- `apps/api/src/__tests__/services/validate-policy-gates.test.ts`
- `apps/api/src/__tests__/services/background-service-unref.test.ts`
- `apps/api/src/__tests__/services/read-model-fetchers-credentials.test.ts`
- `tasks/todo.md`

# Date
- 2026-03-06
