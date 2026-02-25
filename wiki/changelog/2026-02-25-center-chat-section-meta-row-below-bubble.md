# 2026-02-25 Center Chat Section Meta Row Below Bubble
# What changed
- Moved the assistant/pipeline section metadata (`icon + title + timestamp` layout) to match the reference structure:
  - icon on the left of the message row
  - content bubble in the center
  - section title + timestamp rendered below the bubble, aligned to the right
- Kept the `Clean / Original` toggle above the bubble (when present).

# Why it changed
- The user requested each center-column section to match the attached reference, where title and timestamp appear below the message bubble instead of above it.

# Impact (UI / logic / data)
- UI: Assistant/pipeline chat sections now follow the requested metadata placement pattern.
- Logic: No changes.
- Data: No changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatMessage.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/changelog/2026-02-25-center-chat-section-meta-row-below-bubble.md

# Date
2026-02-25
