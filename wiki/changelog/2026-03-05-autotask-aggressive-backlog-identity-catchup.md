# Autotask Aggressive Backlog Identity Catch-up

# What changed
- `apps/api/src/services/orchestration/ticket-workflow-core.ts`
  - added `runInboxHydrationSweep()` as an explicit tenant-scoped background catch-up for unresolved inbox tickets
  - hydration sweep supports `oldest-first` strategy and bounded remote fetch sizing
  - local snapshot promotion now allows remote fetch to continue when the ticket still satisfies `needsInboxHydration`
- `apps/api/src/services/adapters/autotask-polling.ts`
  - poller now triggers the explicit inbox hydration sweep after recent triage dispatch
  - default aggressive catch-up config:
    - `AUTOTASK_POLLER_BACKLOG_IDENTITY_CATCHUP_ENABLED=true`
    - `AUTOTASK_POLLER_BACKLOG_IDENTITY_CATCHUP_BATCH_SIZE=100`
    - `AUTOTASK_POLLER_BACKLOG_IDENTITY_CATCHUP_REMOTE_BATCH_SIZE=50`
- Tests updated:
  - `apps/api/src/__tests__/services/ticket-workflow-core.test.ts`
  - `apps/api/src/__tests__/services/autotask-polling.test.ts`

# Why it changed
- Older unresolved tickets were improving too slowly because queue snapshot hydration was still bounded and the explicit remote hydration path was only available on read-side code.
- A local hydration shortcut treated `created_at` alone as “handled”, which prevented remote fetches from filling `Org/Requester`.
- The user explicitly requested an aggressive catch-up path to drain old unresolved tickets without waiting on UI refreshes.

# Impact (UI / logic / data)
- UI:
  - sidebar cards now converge faster in the background instead of waiting for manual reads/retries
- Logic:
  - backlog catch-up runs from the poller using read-only Autotask fetches and tenant-scoped workflow updates
  - catch-up favors oldest unresolved tickets first
- Data:
  - on the live tenant for `igor@refreshtech.com`, older tickets missing `Org/Requester` dropped from `61` to `44` after the first cycle and to `34` after the second cycle
  - remaining unresolved cases are now mostly constrained by missing `contactId` or missing IDs in the PSA snapshot, not starvation

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/orchestration/ticket-workflow-core.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/adapters/autotask-polling.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/ticket-workflow-core.test.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/autotask-polling.test.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-03-05
