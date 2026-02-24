# 2026-02-24 Clean Ticket Text Rich Formatting Heuristics
# What changed
- Improved the visual formatting of the `Clean` ticket text shown in the Autotask timeline message (`Clean | Original` toggle).
- Added deterministic frontend heuristics to create paragraph/list/callout separation before passing the text into `MarkdownRenderer`.
- Kept `Original` rendering unchanged.

# Why it changed
- The cleaned text was often displayed as a dense block, making onboarding/checklist-heavy tickets difficult to scan quickly.
- This provides a consistent readability upgrade without changing the backend pipeline or spending extra LLM tokens.

# Impact (UI / logic / data)
- UI: `Clean` view is easier to scan (especially numbered user lists and notes).
- Logic: Presentation-only transformation in frontend `ChatMessage`.
- Data: No backend/schema/payload changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatMessage.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md

# Date
- 2026-02-24
