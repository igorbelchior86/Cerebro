# Sidebar Navigation Persistence
# What changed
- Implemented sidebar state persistence for filter and list scroll position.
- Added restore logic on mount to keep the user in the same list context after selecting a ticket.
- Added query-param synchronization for sidebar filter (`sidebarFilter`) so navigation keeps selected filter state.
- Updated ticket selection navigation to use `scroll: false` and avoid default top-jump behavior.

# Why it changed
- Selecting tickets was remounting UI and resetting sidebar context, causing disorientation.
- Users lost position when selecting tickets from lower list positions.
- Active filter state (`all/active/done/failed`) was reset after navigation.

# Impact (UI / logic / data)
- UI: Sidebar now preserves scroll position and active filter across ticket navigations.
- Logic: Added deterministic persistence/restore flow via `sessionStorage` + URL query sync.
- Data: No backend schema/data changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatSidebar.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/home/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx

# Date
- 2026-02-20
