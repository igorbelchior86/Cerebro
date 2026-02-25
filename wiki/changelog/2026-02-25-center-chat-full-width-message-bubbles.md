# 2026-02-25 Center Chat Full-Width Message Bubbles
# What changed
- Converted center-column chat messages into conversation bubbles for both user and assistant messages.
- Made the message bubble width fill the available message container width (instead of narrow/inline user bubbles).
- Wrapped assistant markdown content/steps inside a dedicated bubble shell for consistent chat-balloon presentation.

# Why it changed
- The user requested chatbot text in the center column to be displayed as conversation balloons, with the balloon occupying the container width.

# Impact (UI / logic / data)
- UI: Chat messages in the center column now render as full-width conversation bubbles.
- Logic: No changes.
- Data: No changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatMessage.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/changelog/2026-02-25-center-chat-full-width-message-bubbles.md

# Date
2026-02-25
