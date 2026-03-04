# Sidebar dynamic ACTIVE counter by selected view
# What changed
- Updated the `ACTIVE` counter (next to `New Ticket`) to always show the number of tickets currently visible in the selected sidebar view.
- Counter now updates with the active scope and filters:
  - `Personal` total in current personal view
  - `Personal + Queue` total in the selected personal queue
  - `Global` total in current global view
  - `Global + Queue` total in the selected global queue
  - status-filter selections from the filter popover
- Fixed filter popover scope behavior so it can be used in both Personal and Global (it closes on scope switch and reopens correctly in the new scope).

# Why it changed
- Product requirement: counter must reflect the actual list the user is seeing, not a static or partial metric.

# Impact (UI / logic / data)
- UI:
  - `ACTIVE` value is now dynamic and aligned with the currently displayed ticket list.
- Logic:
  - Counter source changed to the post-filter visible list (`sortedVisible.length`, excluding draft placeholder).
  - Scope-switch popover close behavior made symmetric for Personal/Global.
- Data:
  - No API, storage, or schema changes.

# Files touched
- `apps/web/src/features/chat/sidebar/useSidebarState.ts`
- `apps/web/src/features/chat/sidebar/SidebarControls.tsx`

# Date
- 2026-03-04
