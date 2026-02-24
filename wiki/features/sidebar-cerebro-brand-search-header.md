# Sidebar Cerebro Brand + Search Header
# What changed
- Replaced the left sidebar header branding block (`logo + Playbook Brain/Triage Copilot + clock/toggle`) with a new `Cerebro` brand header.
- Added a custom inline SVG logo mark for Cerebro in the sidebar.
- Added a search field in the header row (top-right area) to search/filter ticket cards in the left sidebar.
- Removed the “Listening for Autotask tickets...” status strip and replaced it with the clock and dark/light toggle controls.

# Why it changed
- Match the requested sidebar visual direction and branding (`Cerebro`).
- Improve header utility by surfacing search directly in the first row while keeping theme/time controls accessible below.

# Impact (UI / logic / data)
- UI: Left sidebar header layout and branding updated.
- Logic: Sidebar ticket list now supports local text filtering from the new search field.
- Data: No changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatSidebar.tsx

# Date
- 2026-02-24
