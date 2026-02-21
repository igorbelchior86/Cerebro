# Hypotheses Card Layout V2
# What changed
- Redesigned hypothesis card internal layout for readability and hierarchy.
- Added structured header row with:
- Rank badge
- Category label (Hardware/Network/Identity/Security/Operational)
- Confidence pill (High/Medium/Low + %)
- Evidence action button
- Moved evidence details into inline drawer section (inside card) instead of floating popover.
- Added full-width confidence bar row at card footer with explicit label and percentage.
- Tuned typography/spacing for hypothesis body to reduce visual weight.

# Why it changed
- Previous layout had weak information hierarchy and low scanability.
- Needed cleaner, modern card composition consistent with app style.

# Impact (UI / logic / data)
- UI: clearer structure, better confidence readability, less clutter.
- Logic: frontend-only rendering changes.
- Data: unchanged.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/PlaybookPanel.tsx`

# Date
- 2026-02-21
