# Sidebar Card Readability Update
# What changed
- Changed ticket subject rendering from single-line truncation to 2-line wrapped clamp with ellipsis.
- Moved `company • requester` to the same horizontal row as ticket time.
- Kept right-side context text truncated and right-aligned to avoid overflow.

# Why it changed
- Single-line subject was cutting key ticket context too aggressively.
- Metadata layout was less efficient for scanning cards quickly.

# Impact (UI / logic / data)
- UI: Better subject readability and cleaner metadata hierarchy.
- Logic: No business logic changes.
- Data: No data contract changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatSidebar.tsx

# Date
- 2026-02-20
