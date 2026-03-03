# Title
Distributed Cache for Autotask/Workflow + Frontend Dedupe
# What changed
- Added `DistributedCacheService` with tenant-scoped versioned keys, stale-while-revalidate, local singleflight, distributed Redis lock (`NX/PX`), tag-based invalidation, negative cache TTL support, payload cap, and circuit-breaker fallback to memory.
- Integrated backend cache in Autotask read-heavy routes:
- `GET /autotask/ticket-draft-defaults`
- `GET /autotask/queues`
- `GET /autotask/companies/search`
- `GET /autotask/contacts/search`
- `GET /autotask/resources/search`
- Integrated short cache in `GET /workflow/inbox` and added tenant/domain invalidation on workflow write/sync routes.
- Removed `_ts=Date.now()` cache-busting from `full-flow` polling requests in triage detail page.
- Added frontend GET cache/dedupe/SWR behavior in `p0-ui-client` and enabled it for inbox, metadata, and Autotask search reads.

# Why it changed
- Reduce repeated live pulls to Autotask and internal workflow reads under polling/search-heavy UX.
- Prevent cache stampede and duplicate concurrent upstream calls.
- Preserve tenant isolation in all cache keys/tags to avoid cross-tenant leakage.
- Keep UI responsive with stale-safe reads while background refresh updates cache.

# Impact (UI / logic / data)
- UI:
- Faster repeated opens/searches due client-side dedupe + SWR.
- `full-flow` polling no longer bypasses cache on every request.
- Logic:
- Read endpoints now prefer cached values and refresh asynchronously.
- Workflow inbox cache invalidates deterministically on command/sync/reconcile writes.
- Data:
- No schema migrations.
- No persistence contract change to business tables.
- Added cache metadata envelope in selected read responses (`cache`).

# Files touched
- `apps/api/src/services/cache/distributed-cache.ts`
- `apps/api/src/services/application/route-handlers/autotask-route-handlers.ts`
- `apps/api/src/services/application/route-handlers/workflow-route-handlers.ts`
- `apps/web/src/lib/p0-ui-client.ts`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-03
