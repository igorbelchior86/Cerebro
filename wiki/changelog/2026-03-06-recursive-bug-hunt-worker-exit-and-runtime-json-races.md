# Recursive Bug Hunt: Worker Exit And Runtime JSON Races
# What changed
- Fixed timer leakage in [autotask-polling.test.ts](/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/autotask-polling.test.ts) by replacing live latency waits with fake timers and clearing timers after each test.
- Fixed concurrent temp-file collisions in [runtime-json-file.ts](/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/runtime-json-file.ts) and [runtime-json-file.ts](/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/read-models/runtime-json-file.ts) by giving each atomic write a unique temp filename and cleaning it up after the rename.
- Added [runtime-json-file.test.ts](/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/runtime-json-file.test.ts) to spawn concurrent writers against the same file and verify the collision no longer happens.
- Fixed leaked hydration timeout timers in [ticket-workflow-core.ts](/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/orchestration/ticket-workflow-core.ts) by clearing the timeout when the remote snapshot returns before the timeout wins.
- Added a regression test in [ticket-workflow-core.test.ts](/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/ticket-workflow-core.test.ts) to assert no timers remain after a successful hydration sweep.

# Why it changed
- The repo-wide bug hunt still had reproducible issues after the previous pass.
- The Autotask poller tests left timing resources alive in worker processes.
- Runtime JSON persistence could fail under parallel writes because multiple writers reused the same `.tmp` file name.
- `ticket-workflow-core` still left pending timeout timers behind, which was the remaining cause of the recurring Jest worker-exit warning even when all tests passed.

# Impact (UI / logic / data)
- UI: no direct UI behavior change.
- Logic: test infrastructure is more deterministic, atomic file writes are safe under concurrent writers, and inbox hydration no longer leaves stale timeout timers behind.
- Data: runtime JSON persistence now avoids cross-writer temp-file clobbering, so transient `ENOENT` write failures are removed from concurrent execution paths.

# Files touched
- [autotask-polling.test.ts](/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/autotask-polling.test.ts)
- [runtime-json-file.test.ts](/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/runtime-json-file.test.ts)
- [ticket-workflow-core.test.ts](/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/ticket-workflow-core.test.ts)
- [ticket-workflow-core.ts](/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/orchestration/ticket-workflow-core.ts)
- [runtime-json-file.ts](/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/read-models/runtime-json-file.ts)
- [runtime-json-file.ts](/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/runtime-json-file.ts)

# Date
- 2026-03-06
