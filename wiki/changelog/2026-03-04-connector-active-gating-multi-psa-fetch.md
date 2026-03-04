# Connector-active fetch gating for multi-PSA
# What changed
- Added a centralized integration capability guard in `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/lib/p0-ui-client.ts`.
- The client now loads tenant connector capabilities from `/integrations/credentials` (cached for 30 seconds) and blocks requests to inactive connectors before network calls.
- Added `listAutotaskQueues()` in the shared client and migrated sidebar queue catalog loading to use it.
- Removed direct sidebar fetch to `/autotask/queues`; requests now go through the guarded client path.

# Why it changed
- The app was still issuing Autotask requests when Autotask connector was disconnected, generating noisy `503` errors and violating multi-PSA behavior.
- Multi-connector architecture requires connector-aware data fetching: only active connectors should be queried per tenant.

# Impact (UI / logic / data)
- UI: sidebar and other views stop attempting connector requests for inactive services, reducing console/network errors.
- Logic: integration request routing is now capability-gated centrally, not by ad-hoc component checks.
- Data: no schema or persistence changes.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/lib/p0-ui-client.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/features/chat/sidebar/useSidebarState.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-03-04
