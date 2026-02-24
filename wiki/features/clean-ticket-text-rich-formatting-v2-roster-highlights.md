# Clean Ticket Text Rich Formatting V2 (Roster + Highlights + Badge)
# What changed
- Upgraded the `Clean` ticket text display in `ChatMessage` from markdown-only normalization to a structured UI renderer for `Autotask` clean text.
- Reworked the roster visualization after UX feedback:
  - removed repeated roster cards (too visually heavy / misleading)
  - added a collapsed disclosure (`Detected Users`) with a compact heuristic table (`Name`, `Employment`, `Device`, `Location`, `Notes`)
  - added explicit low-confidence wording (`heuristic parse, may be incomplete`)
- Reduced inline highlighting to date/deadline/action cues only (removed aggressive vendor/device chips in body text).
- Replaced the in-toggle `fmt` badge with a subtle helper line below the message header (`Display formatting applied (heuristic)`).
- Kept `Original` mode unchanged.

# Why it changed
- The initial “rich formatting” version overfit the heuristics visually and made ambiguous parsed rows look like trusted structured data.
- The redesign keeps the clean text as the primary reading surface and demotes heuristic extraction to a secondary, optional aid.

# Impact (UI / logic / data)
- UI: `Clean` mode now shows calmer primary text plus optional heuristic roster disclosure (table), with more restrained highlights.
- Logic: Frontend-only heuristics in `ChatMessage`; scoped to `autotask` + `Clean` display path.
- Data: No backend/pipeline/LLM changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatMessage.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md

# Date
- 2026-02-24
