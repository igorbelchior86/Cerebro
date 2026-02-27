# Title
ChatInput Suggestions Repositioned as Top Tabs (Pop-out)

# What changed
Moved suggestion chips from below the toolbar to a top strip above the text field, styled as tabs that visually pop out from the composer container.

# Why it changed
The requested interaction pattern is a tab-like quick-action area above the input, improving visibility and matching the intended PSA-oriented composition layout.

# Impact (UI / logic / data)
- UI: Suggestions now appear above input as top tabs (`border-bottom: none`, top radius, negative vertical offset).
- Logic: No behavioral change; clicking a suggestion still injects text into the input.
- Data: No API, persistence, or backend contract changes.

# Files touched
- apps/web/src/components/ChatInput.tsx
- tasks/todo.md
- wiki/features/2026-02-27-chatinput-hints-tab-popout.md

# Date
2026-02-27
