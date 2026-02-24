# 2026-02-24 Clean Ticket Text V2 Redesign (Disclosure Table + Softer Highlights)
# What changed
- Redesigned the `Clean` ticket text UI after feedback that the first roster-card formatting was confusing and visually heavy.
- Replaced roster cards with a collapsed `Detected Users` disclosure containing a compact heuristic table.
- Added explicit “heuristic parse, may be incomplete” messaging to avoid implying high-confidence structured extraction.
- Reduced inline highlights to dates/deadlines/action cues only.
- Removed the `fmt` badge from the `Clean` toggle pill and replaced it with subtle helper text below the header.

# Why it changed
- The previous UI made partially parsed rows look authoritative and added too much visual noise, especially above the `PrepareContext` enrichment content.

# Impact (UI / logic / data)
- UI: Cleaner hierarchy, less noisy `Clean` text, optional structured extraction, improved timeline balance.
- Logic: Frontend-only rendering changes in `ChatMessage`.
- Data: No schema/API/payload changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatMessage.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/features/clean-ticket-text-rich-formatting-v2-roster-highlights.md

# Date
- 2026-02-24
