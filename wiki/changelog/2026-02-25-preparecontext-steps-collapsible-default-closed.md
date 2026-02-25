# 2026-02-25 PrepareContext Steps Collapsible (Default Closed)
# What changed
- Wrapped `PrepareContext` step items (`message.type === evidence`) in a collapsible section inside the chat bubble.
- The section is collapsed by default and can be expanded by the user.
- Kept step rendering unchanged for other chat message types.

# Why it changed
- The user requested the `PrepareContext` chat balloon items to be shown in a collapsible section by default.

# Impact (UI / logic / data)
- UI: `PrepareContext` step list is now hidden by default behind an expandable summary.
- Logic: No changes.
- Data: No changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatMessage.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/changelog/2026-02-25-preparecontext-steps-collapsible-default-closed.md

# Date
2026-02-25
