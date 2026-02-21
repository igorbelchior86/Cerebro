# Sidebar Ticket Card V2 Layout
# What changed
- Redesigned left sidebar ticket cards with stronger hierarchy and cleaner internal layout.
- Kept a single status badge in the card header (removed duplicate status treatment in the lower section).
- Promoted priority + ticket ID row and refined selected/hover visual feedback.
- Upgraded metadata block with compact iconography for time, company, and requester.
- Increased title emphasis and preserved 2-line clamp for readability.

# Why it changed
- Previous card composition felt visually flat and redundant, reducing scan speed in dense ticket lists.
- User requested a modern, cleaner, and more coherent card layout in the left sidebar.

# Impact (UI / logic / data)
- UI: clearer information hierarchy, less noise, improved glanceability and state feedback.
- Logic: no ticket selection or filtering behavior changed.
- Data: no contract/schema changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatSidebar.tsx

# Date
- 2026-02-21
