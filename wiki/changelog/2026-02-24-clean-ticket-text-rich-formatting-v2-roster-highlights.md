# 2026-02-24 Clean Ticket Text Rich Formatting V2 (Roster + Highlights + Badge)
# What changed
- Added a structured `Clean` text renderer for Autotask timeline messages in `ChatMessage`.
- Detects onboarding-style numbered user rosters and renders them as compact cards.
- Highlights dates/deadline-like tokens and device/platform terms in the `Clean` view.
- Shows a subtle `fmt` badge in the `Clean` toggle when display-enhancement heuristics are active.

# Why it changed
- Improve scanability of long onboarding and checklist-heavy tickets without changing the backend cleanup pipeline or spending extra LLM tokens.

# Impact (UI / logic / data)
- UI: Better readability in `Clean` mode; `Original` remains raw/plain.
- Logic: Frontend-only deterministic formatter + renderer.
- Data: No schema/API/payload changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatMessage.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md

# Date
- 2026-02-24
