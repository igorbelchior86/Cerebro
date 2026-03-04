# Title
Queue Catalog: no silent empty success
# What changed
- Updated `GET /autotask/queues` to return `503` when Autotask is degraded and there is no valid cached queue catalog, instead of returning `200 success` with empty `data`.
- Updated sidebar queue catalog hydration to ignore normalized empty queue lists, preventing overwrite of existing/fallback catalog with `[]`.

# Why it changed
- The previous behavior could look like “queues disappeared” while the provider was failing, because the API replied success with no rows.
- This change makes failure explicit and avoids destructive empty-state overwrite in UI.

# Impact (UI / logic / data)
- UI:
- Queue dropdown no longer collapses to an empty catalog due to transient provider failure with cold cache.
- Logic:
- Queue endpoint now fails explicitly (`503`) in no-cache degraded scenarios.
- Data:
- No schema changes.

# Files touched
- `apps/api/src/services/application/route-handlers/autotask-route-handlers.ts`
- `apps/web/src/features/chat/sidebar/useSidebarState.ts`
- `tasks/todo.md`

# Date
- 2026-03-03
