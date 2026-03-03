# Title
Sidebar profile display name fallback no longer hardcodes John Technician

# What changed
- Replaced sidebar display-name fallback logic from a hardcoded string (`John Technician`) to deterministic identity resolution:
  - `user.name` (if present)
  - email prefix (before `@`)
  - `Account` as neutral fallback

# Why it changed
- Users with `name` unset were always rendered as `John Technician`, creating false perception that login/session was stuck on a fixed profile.

# Impact (UI / logic / data)
- UI: profile card now reflects authenticated identity correctly even when `name` is null.
- Logic: no auth/session backend behavior changed; only display fallback projection in sidebar.
- Data: no database or API contract changes.

# Files touched
- `apps/web/src/features/chat/sidebar/useSidebarState.ts`
- `tasks/todo.md`

# Date
2026-03-03
