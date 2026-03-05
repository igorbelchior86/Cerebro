# Autotask Queue Backlog Hydration and Active Snapshot Fix

# What changed
- `apps/api/src/services/adapters/autotask-polling.ts`
  - queue snapshot now resolves canonical identity for backlog tickets that are still missing `company/requester` in the workflow inbox
  - sync `event_id` now includes a stable fingerprint of the canonical payload so reconcile replays apply when identity data improves
  - queue snapshot runs before recent-ticket triage dispatch
  - queue snapshot queries now exclude terminal statuses upstream with `status noteq ...`
  - added operational log `adapters.autotask_polling.parity_queue_snapshot_applied`
- `apps/api/src/__tests__/services/autotask-polling.test.ts`
  - added regressions for backlog identity hydration, payload-sensitive reconcile event ids, queue snapshot ordering before triage, and terminal-status exclusions in queue queries

# Why it changed
- Older tickets were entering the workflow inbox through `autotask_reconcile` without canonical identity lookup.
- Reconcile replays with improved payload were being discarded as duplicates because the previous `event_id` ignored payload changes.
- Queue snapshot was delayed behind recent triage work and was querying full queues before filtering terminal statuses, which made active backlog convergence too slow.

# Impact (UI / logic / data)
- UI:
  - older sidebar cards can now receive `Org/Requester` through automatic queue snapshot reconciliation instead of remaining `null`
  - authenticated `GET /workflow/inbox` returned `124` tickets after the fix on the user tenant, versus the smaller pre-fix materialized set
- Logic:
  - reconcile replays are idempotent per canonical payload revision instead of per timestamp only
  - queue snapshot prioritizes inbox consistency before heavy triage execution
  - active-only filtering happens at the Autotask query boundary
- Data:
  - previously stale inbox rows such as `T20260304.0011`, `T20260303.0015`, and `T20260304.0008` were re-materialized with canonical `company/requester`

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/adapters/autotask-polling.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/autotask-polling.test.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-03-05
