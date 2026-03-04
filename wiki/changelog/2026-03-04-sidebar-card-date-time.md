# Sidebar Card Timestamp: Date + Time
# What changed
- Updated sidebar ticket timestamp formatting logic.
- Tickets created today still show only time (`HH:MM`).
- Tickets from previous days now show full date and time (`MM/DD/YYYY HH:MM`).
- Existing fallback behavior is preserved: when `created_at` is missing/invalid, `age` is used; otherwise `just now`.

# Why it changed
- Showing only time on non-today tickets was ambiguous in the sidebar card view.
- The new rule keeps today cards compact while improving clarity for historical tickets.

# Impact (UI / logic / data)
- UI: improved timestamp readability in sidebar cards.
- Logic: timestamp formatting is now day-aware in `formatCreatedAt`.
- Data: no schema or API contract changes.

# Files touched
- `apps/web/src/features/chat/sidebar/utils.ts`
- `tasks/todo.md`

# Date
- 2026-03-04
