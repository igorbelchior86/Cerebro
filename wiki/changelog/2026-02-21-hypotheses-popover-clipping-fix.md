# 2026-02-21 Hypotheses Popover Clipping Fix
# What changed
- Updated hypothesis evidence popover positioning to remain inside card/panel bounds.
- Changed popover anchoring from right-fixed width to full card width (`left: 0; right: 0; width: 100%`).

# Why it changed
- Popover was being visually clipped when extending toward adjacent layout columns.

# Impact (UI / logic / data)
- UI: popover no longer gets cut by layout boundaries.
- Logic: display-only positioning fix.
- Data: unchanged.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/PlaybookPanel.tsx`

# Date
- 2026-02-21
