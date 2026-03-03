# Title
Sidebar tickets rate-limit degraded read path

# What changed
- Added `classifySidebarTicketsDegradedReason` in the Autotask route handler to degrade only dependency/transient provider failures (`RATE_LIMIT`, `TIMEOUT`, `DEPENDENCY`).
- Added `readSidebarTicketsStale` to reuse last known sidebar snapshot even if TTL is expired during provider instability.
- Updated `GET /autotask/sidebar-tickets` to return `200` with `degraded` envelope and fallback payload (stale cache, otherwise empty list) instead of propagating provider rate-limit as `500`.
- Added regression tests for `/autotask/sidebar-tickets`:
  - rate-limit path returns `200` + `degraded.reason=rate_limited`
  - non-provider internal error still propagates to error middleware (`500`)

# Why it changed
- Burst concurrency against `/autotask/sidebar-tickets` was collapsing into `500` under Autotask 429 thread-threshold, making Global queue unstable/unavailable.
- For this read-only surface, degraded responses preserve sidebar availability and avoid synchronized hard-failure under provider saturation.

# Impact (UI / logic / data)
- UI: Global sidebar keeps receiving a valid response shape under provider throttling; can continue rendering with empty/stale data plus degraded signal.
- Logic: Error handling is now explicit and deterministic for expected dependency failures; unknown/internal failures remain fail-fast.
- Data: No schema/migration changes. In-memory cache reuse only.

# Files touched
- apps/api/src/services/application/route-handlers/autotask-route-handlers.ts
- apps/api/src/__tests__/routes/autotask.sidebar-tickets.test.ts
- tasks/todo.md
- wiki/changelog/2026-03-03-sidebar-tickets-rate-limit-degraded-read-path.md

# Date
2026-03-03
