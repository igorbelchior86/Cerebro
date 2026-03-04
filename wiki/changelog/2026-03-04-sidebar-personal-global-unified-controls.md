# Sidebar controls unified across Personal and Global
# What changed
- Replaced the Personal-only top bar controls (status tabs + suppressed toggle) with the same control pattern used in Global: queue dropdown + status filter button.
- Added independent queue selection state per scope:
  - `selectedPersonalQueue`
  - `selectedGlobalQueue`
- Added independent status filter hidden-key state per scope:
  - `personalHiddenStatusKeys`
  - `globalHiddenStatusKeys`
- Unified filtering behavior so both scopes filter by queue and by status checklist (opened from the filter button).
- Updated sidebar state persistence to store scope + query + per-scope queue selections, and removed legacy tab-filter persistence dependency.

# Why it changed
- Product requirement: Personal must use the same control model as Global while keeping each section isolated to its own filtering items.
- Reduces UI divergence and avoids maintaining two different filter paradigms in the same sidebar surface.

# Impact (UI / logic / data)
- UI:
  - Personal now displays `Queue` label + dropdown + filter button, matching Global.
  - Legacy Personal tabs (`ALL`, `PROCESSING`, `DONE`, `FAILED`) are removed from this bar.
- Logic:
  - Scope-specific queue/status filter states are now explicit and isolated.
  - Ticket visibility pipeline now applies queue/status filtering consistently for both scopes.
- Data:
  - No API contract changes.
  - No schema or persistence migration.

# Files touched
- `apps/web/src/features/chat/sidebar/useSidebarState.ts`
- `apps/web/src/features/chat/sidebar/SidebarControls.tsx`
- `apps/web/src/features/chat/sidebar/ChatSidebar.tsx`

# Date
- 2026-03-04
