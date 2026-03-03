# Autotask Sidebar Tickets Coordination Retry for Lock Misses
# What changed
- Updated sidebar ticket coordination flow in `apps/api/src/services/application/route-handlers/autotask-route-handlers.ts`.
- Added `SIDEBAR_TICKETS_LOCK_RETRY_INTERVAL_MS` and a lock-coordinated loader helper to retry advisory lock acquisition in short intervals.
- Replaced single-shot lock miss behavior with repeated lock attempts + cache polling until coordination timeout.
- Added regression test `apps/api/src/__tests__/services/autotask-route-handlers.sidebar-coordination.test.ts` validating lock miss followed by coordinated retry and single upstream fetch.

# Why it changed
- Under concurrent requests with the same key (`tenant+queue+limit+lookback`), the previous flow could fall through to a direct upstream read after one wait window, amplifying repeated Autotask calls and accelerating provider thread/quota pressure.
- The new flow keeps requests coordinated for longer before fallback, reducing duplicate fanout risk.

# Impact (UI / logic / data)
- UI: No response schema changes for successful `/autotask/sidebar-tickets` calls.
- Logic: Stronger cross-request coordination behavior before direct fallback reads.
- Data: No schema or persistence changes.

# Files touched
- apps/api/src/services/application/route-handlers/autotask-route-handlers.ts
- apps/api/src/__tests__/services/autotask-route-handlers.sidebar-coordination.test.ts
- tasks/todo.md
- tasks/lessons.md

# Date
- 2026-03-03
