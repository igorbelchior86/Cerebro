# Chat Sidebar Hydration Nested Button Fix
# What changed
- Updated `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatSidebar.tsx` so each ticket card is no longer rendered as a native `<button>`.
- The ticket card wrapper now uses a non-button container with `role="button"`, keyboard activation (`Enter` / `Space`), and the same click behavior used to select a ticket.
- The inline status edit control remains a real `<button>`, which removes the invalid `<button>` inside `<button>` structure that was causing hydration failure.

# Why it changed
- React/Next.js hydration was failing because the server-rendered markup included a ticket card `<button>` containing a nested edit-status `<button>`.
- Nested native buttons are invalid HTML and can cause the client tree to diverge during hydration.

# Impact (UI / logic / data)
- UI: Removes the hydration crash in the sidebar while preserving the existing card interaction and inline status edit action.
- Logic: Ticket selection behavior is preserved, now with explicit keyboard handling on the card container.
- Data: No data contract or backend change.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatSidebar.tsx`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-03-01
