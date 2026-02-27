# Title
Changelog: Agent A Phase 2 Realtime

# What changed
- Added backend SSE endpoint `GET /workflow/realtime` with connection handshake and heartbeat.
- Added tenant-scoped realtime hub and workflow event publisher.
- Added frontend realtime integration in polling hook with exponential reconnect backoff.
- Added explicit degraded signal for polling fallback in UI state.
- Added tests for SSE framing/tenant subscription/heartbeat and workflow realtime publishing.

# Why it changed
- Meet acceptance for no-manual-refresh updates when realtime is healthy.
- Preserve resilient behavior when realtime channel is interrupted.

# Impact (UI / logic / data)
- UI: inbox updates faster and indicates degraded mode.
- Logic: push + polling hybrid mode.
- Data: no schema/migration changes.

# Files touched
- `apps/api/src/routes/workflow.ts`
- `apps/api/src/services/workflow-realtime.ts`
- `apps/api/src/services/ticket-workflow-core.ts`
- `apps/web/src/hooks/usePollingResource.ts`
- `apps/api/src/__tests__/services/workflow-realtime.test.ts`

# Date
2026-02-27
