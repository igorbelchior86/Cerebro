# Sidebar Global Queue Status Checkbox Filter
# What changed
- Added a new filter button to the right side of the Global queue dropdown in sidebar controls.
- The button opens a status popover with one checkbox per available ticket status.
- Checkbox state now controls ticket visibility in Global scope: unchecked statuses are removed from the sidebar list.
- Reused existing Autotask status catalog (`statusCatalog`) from `useSidebarState` and merged with live ticket statuses to avoid missing options.
- Added reset action in the popover to re-enable all statuses.

# Why it changed
- User requirement: parity with the existing personal filter-button interaction, but applied to Global queue with explicit per-status visibility control.

# Impact (UI / logic / data)
- UI:
  - New global-status filter button appears next to queue selector.
  - Popover lists statuses with checkbox and ticket count.
- Logic:
  - Global list filtering now includes status-key matching (`id:*`, `label:*`, fallback `workflow:*`) and excludes unchecked statuses.
  - Personal scope behavior remains unchanged.
- Data:
  - No API or persistence schema changes.

# Files touched
- `apps/web/src/features/chat/sidebar/useSidebarState.ts`
- `apps/web/src/features/chat/sidebar/SidebarControls.tsx`
- `apps/web/src/features/chat/sidebar/ChatSidebar.tsx`
- `apps/web/messages/en.json`
- `tasks/todo.md`

# Date
- 2026-03-03
