# Title
Sidebar Tickets Inter-Process Coordination
# What changed
- Added request coordination for `GET /autotask/sidebar-tickets` in `autotask-route-handlers.ts`.
- Added short-lived tenant-scoped cache (5s TTL) for identical sidebar requests (`tenant + queueId + limit + lookbackHours`).
- Added in-process in-flight deduplication to coalesce concurrent identical requests inside one API instance.
- Added inter-process coordination using PostgreSQL advisory lock (`pg_try_advisory_lock`) keyed by request signature.
- Added wait-for-cache fallback path when lock is held by another instance, then direct fetch fallback for availability.
- Kept existing response contract (`success`, `data`, `count`, `source`, `queueId`, `lookbackHours`, `timestamp`).

# Why it changed
- Equivalent `/sidebar-tickets` requests across multiple API instances were recomputing the same expensive Autotask search/enrichment path.
- This caused avoidable load spikes and response variance between instances.
- The fix provides deterministic coalescing behavior with bounded staleness and no contract changes.

# Impact (UI / logic / data)
- UI: No payload/contract change; faster and more stable responses under concurrent refreshes.
- Logic: Added cache+singleflight+advisory-lock coordination around sidebar ticket fetch computation.
- Data: No schema migration; no persisted state changes (process-local cache + existing DB advisory lock only).

# Files touched
- `apps/api/src/services/application/route-handlers/autotask-route-handlers.ts`
- `tasks/todo.md`
- `tasks/lessons.md`
- `wiki/changelog/2026-03-03-sidebar-tickets-interprocess-coordination.md`

# Date
2026-03-03
