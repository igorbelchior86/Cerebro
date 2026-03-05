# Integrations Health: Autotask real-read validation + stale badge fix
# What changed
- Updated Autotask health check to mark `connected` only after a real read operation succeeds (`getTicketQueues`), instead of relying only on zone discovery.
- Kept latency measurement, now tied to the end-to-end read-path check.
- Normalized auth failures (`401/Unauthorized`) to explicit detail: `Authentication failed — check credentials`.
- Updated Settings UI loading logic to clear stale health/saved snapshots when `/integrations/health` or `/integrations/credentials` fails, preventing stale `Connected` badges.

# Why it changed
- The previous behavior could show `Connected · Xms` while runtime routes like `/autotask/queues` were failing with `503`.
- Product behavior now aligns with operational reality: `connected` means read path is truly operational.

# Impact (UI / logic / data)
- UI:
  - Settings no longer keeps stale `Connected` state after health endpoint failure.
- Logic:
  - Autotask health status is now stricter and production-meaningful.
- Data:
  - No schema/data migration changes.

# Files touched
- `apps/api/src/services/application/route-handlers/integrations-route-handlers.ts`
- `apps/web/src/components/SettingsModal.tsx`

# Date
- 2026-03-05
