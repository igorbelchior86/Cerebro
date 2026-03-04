# Sidebar Top Unknown Dedupe Fix and Persistent Read Cache
# What changed
- Fixed workflow inbox alias dedupe to prefer meaningful `company/requester` over placeholder values.
- Added persistent browser read-cache storage for key UI hydration endpoints (`/workflow/inbox`, queue catalog, field options).
- Added cache hydration on client boot and persistence updates on cache writes/deletes.
- Increased `listWorkflowInbox` client cache windows to reduce aggressive re-fetching after login/reload.
- Added regression test covering alias dedupe with placeholder vs canonical values.

# Why it changed
- Recent tickets at the top of sidebar were still showing `Unknown org/requester` despite polling.
- Root cause was final dedupe preserving placeholder values from one alias row while discarding canonical values from another alias row.
- Local in-memory cache was lost on page reload/login, causing repeated refetches with no persisted warm state.

# Impact (UI / logic / data)
- UI: top cards converge faster to canonical values and stop sticking on placeholders due to alias merge behavior.
- Logic: dedupe now applies meaningful-value semantics consistently.
- Cache: client read cache survives reload/login via local storage (best-effort), reducing repeated fetch pressure.
- Data: no schema changes.

# Files touched
- `apps/api/src/services/orchestration/ticket-workflow-core.ts`
- `apps/api/src/__tests__/services/ticket-workflow-core.test.ts`
- `apps/web/src/lib/p0-ui-client.ts`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-04
