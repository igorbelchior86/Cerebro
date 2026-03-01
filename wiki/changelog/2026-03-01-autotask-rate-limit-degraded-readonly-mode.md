# Autotask Rate Limit Degraded Readonly Mode
# What changed
- Read-only Autotask selector routes now degrade safely during provider failures and `429` rate limits instead of bubbling generic `500` errors.
- Ticket field options now use in-memory cache for the latest successful payload and reuse cached values (or empty arrays) when the provider is unavailable or rate-limited.
- Ticket draft defaults now reuse the last successful defaults payload when the provider is rate-limited.
- The Autotask poller now enters a 15-minute cooldown after a rate-limit failure to reduce further quota pressure.

# Why it changed
- The UI was surfacing `Internal Server Error` because the backend was converting Autotask `429` responses into generic `500` responses on read-only metadata endpoints.
- Runtime logs also showed the Autotask tenant had exceeded both the thread threshold and the internal request quota, so continuing to poll aggressively made recovery worse.
- The correct behavior for read-only selectors is degraded mode, not hard failure.

# Impact (UI / logic / data)
- UI: Dropdowns and metadata bootstrap no longer fail with generic server errors when Autotask is throttling; they receive cached or empty results with degraded semantics.
- Logic: Read-only routes now classify provider failures and fail open for selector/bootstrap surfaces. Polling now backs off for 15 minutes on rate-limit events.
- Data: No schema or persistence changes. Cache is process-local memory only.

# Files touched
- `apps/api/src/routes/autotask.ts`
- `apps/api/src/services/autotask-polling.ts`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-01
