# Clean Ticket Text Rich Formatting Heuristics
# What changed
- Added deterministic frontend formatting heuristics for the `Clean` ticket-text toggle in triage messages (`Autotask` event).
- The formatter improves readability by:
  - splitting inline numbered sequences into separate list-like lines (`1.`, `2.`, ...)
  - creating consistent paragraph breaks
  - separating common callout markers like `NOTE:` / `GOAL:`
  - isolating signature-like lines (`Thanks`, `Direct:`, `Phone:`) when present
- The `Original` toggle remains unchanged.

# Why it changed
- The cleaned ticket text content was often semantically good but visually dense and hard to scan (long single paragraphs, inline numbered lists, signatures mixed into the main body).
- A local heuristic formatter gives consistent improvement without requiring additional LLM formatting/token spend.

# Impact (UI / logic / data)
- UI: `Clean` text under the Autotask timeline card is more readable and consistently structured.
- Logic: Pure presentation-layer transformation in `ChatMessage`; no pipeline or backend changes.
- Data: No data model changes. Original payload text is preserved.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatMessage.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md

# Date
- 2026-02-24
