# Autotask Backlog Fairness Oldest-First Hydration

# What changed
- `apps/api/src/services/adapters/autotask-polling.ts`
  - `runQueueParitySnapshot()` now asks canonical identity lookup to prioritize backlog tickets by oldest `createDate` first
  - recent poll ingestion keeps the existing recent-first priority; only backlog reconciliation changed
- `apps/api/src/__tests__/services/autotask-polling.test.ts`
  - added regression proving capped queue snapshot hydration resolves the oldest missing backlog ticket before newer ones

# Why it changed
- The previous backlog reconcile path still used newest-first ordering inside `resolveCanonicalIdentityBatch()`.
- Because the lookup remained capped per run, older tickets could stay permanently behind newer missing tickets and never receive `Org/Requester`.

# Impact (UI / logic / data)
- UI:
  - old sidebar cards stop starving behind newer tickets and begin to converge with canonical `Org/Requester`
- Logic:
  - backlog reconciliation now has fairness semantics aligned with historical drain instead of recent intake
- Data:
  - on the live tenant for `igor@refreshtech.com`, older tickets missing identity dropped from `85` to `71` after the first poller cycle following the fix
  - examples that hydrated after the fairness fix include `T20260302.0017` (`Weaver Bennett & Bland` / `Eran Weaver`) and `T20251216.0014` (`Stintino Management`)

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/adapters/autotask-polling.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/autotask-polling.test.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-03-05
