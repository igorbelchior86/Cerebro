# Sidebar Tickets Rate-Limit Degradation Cooldown
# What changed
- Updated `GET /autotask/sidebar-tickets` to fail-open under Autotask throttling/dependency errors instead of bubbling `500`.
- Added explicit recognition of Autotask `thread threshold` error patterns as `rate_limited` degradation.
- Added per-key cooldown (`tenant + queue + limit + lookback`) after `rate_limited` responses to prevent immediate upstream retries.
- Prevented duplicate upstream retries in the lock path: provider errors thrown inside advisory-lock execution no longer trigger an extra direct fetch in the same request.
- Added route regression tests covering degraded `200` behavior and cooldown retry suppression.

# Why it changed
- Under parallel load, Autotask `429`/thread-threshold responses were escalating to unhandled server errors (`500`) and sustaining pressure on the provider.
- The prior coordination flow could retry provider reads in the same request after lock-path errors, amplifying rate-limit saturation.

# Impact (UI / logic / data)
- UI: Sidebar global queue keeps responding (`200`) with degraded metadata instead of hard failure during provider throttling windows.
- Logic: Read path now applies deterministic degradation + temporary cooldown for rate-limited keys; no write-path behavior changed.
- Data: No schema/migration changes; response payload remains compatible with added optional `degraded.cooldownUntil` field.

# Files touched
- `apps/api/src/services/application/route-handlers/autotask-route-handlers.ts`
- `apps/api/src/__tests__/routes/autotask.sidebar-tickets.degradation.test.ts`
- `tasks/todo.md`

# Date
- 2026-03-03
