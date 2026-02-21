# Right Sidebar Resize + Internal Scroll Fix
# What changed
- Removed fixed width from the right sidebar child panel and made it fill the resizable container.
- Added flex/overflow constraints to ensure internal scrolling works reliably.
- Kept existing resizer logic and only fixed layout constraints.

# Why it changed
- The right pane was visually ignoring resize because `PlaybookPanel` forced `360px` width.
- Internal scroll was unstable due to missing `minHeight: 0`/overflow chain in nested flex containers.

# Impact (UI / logic / data)
- UI: Right sidebar now resizes dynamically like the left sidebar.
- UI: Scroll remains inside the right panel content area.
- Logic/Data: No business logic or backend data changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/PlaybookPanel.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ResizableLayout.tsx

# Date
- 2026-02-20
