# 2026-02-25 Center Chat Icon Reposition (Bottom-Left) and Meta Order
# What changed
- Refactored assistant/pipeline message row structure so the icon is aligned to the `toggle + bubble` block (and no longer affected by the metadata row below).
- Repositioned assistant/pipeline message icons to align on the lower-left of the bubble area.
- Kept the original icons (no icon asset replacement).
- Inverted the metadata row order below the bubble to render `timestamp` before `title`.

# Why it changed
- The user clarified the icon issue was positional only (left-upper vs left-lower), and explicitly requested preserving the existing icons.
- The user also requested timestamp to appear before the title in the metadata row.

# Impact (UI / logic / data)
- UI: Pipeline message rows now align icons with the lower-left of each bubble area and show metadata in the requested order.
- Logic: No changes.
- Data: No changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatMessage.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/changelog/2026-02-25-center-chat-icon-reposition-bottom-left-and-meta-order.md

# Date
2026-02-25
