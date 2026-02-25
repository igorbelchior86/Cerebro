# 2026-02-24 Sidebar Structural Gutter Below Time Toggle
# What changed
- Split the left sidebar into two internal modules (top header module and main content module) using separate panel wrappers.
- Added a real `18px` gutter gap between these wrappers so the `search + clock/theme` section is structurally detached from the rest of the sidebar.
- Removed the previous dependence on internal spacing-only separation below the `clock + dark/light toggle` strip.
- Follow-up visual parity tuning (from screenshot feedback): increased module spacing/padding and wrapper corner radius so the top header block reads as a more clearly detached section.

# Why it changed
- The first implementation only added spacing and did not create the same modular highlight pattern used by the columns.
- The user clarified that the header must be highlighted as a full section, not just offset by an internal spacer.
- A second screenshot clarification required stronger geometric parity (larger gutter and softer/larger module shells), not only structural separation.

# Impact (UI / logic / data)
- UI: The `search + clock/theme` block now reads as its own sub-panel, with stronger visual detachment (module shell + larger gutter) closer to the provided reference.
- Logic: No changes.
- Data: No changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatSidebar.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/changelog/2026-02-24-sidebar-structural-gutter-below-time-toggle.md

# Date
2026-02-24
