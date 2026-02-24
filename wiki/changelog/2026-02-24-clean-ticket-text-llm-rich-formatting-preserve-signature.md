# 2026-02-24 Clean Ticket Text LLM Rich Formatting (Preserve Signature)
# What changed
- `prepare-context` LLM normalization prompt now returns a rich Markdown display variant (`description_display_markdown`) in addition to canonical plain cleaned text.
- New `ticket_text_artifact` payload fields added (JSON-only, no migration):
  - `text_clean_display_markdown`
  - `text_clean_display_format`
- Triage timeline `Autotask` message now uses the display markdown for the `Clean` toggle when present.
- `ChatMessage` renders `Clean` as direct markdown for `markdown_llm` tickets and falls back to the existing heuristic formatter for plain/legacy tickets.
- The `Clean` toggle payload no longer prepends the verbose `Cleaned ticket text...` label.

# Why it changed
- Frontend heuristics alone were not robust enough for messy email/Autotask bodies (HTML blobs, disclaimers, duplicated templates, merged rosters).
- User requested LLM-based cleanup/rich formatting and explicitly required preserving the signature/contact block.

# Impact (UI / logic / data)
- UI: Cleaner `Clean` rendering path with LLM-authored Markdown when available; backward-compatible fallback remains.
- Logic: Separation of concerns between pipeline canonical text (`text_clean`) and UI display markdown (`text_clean_display_markdown`).
- Data: JSON artifact payload shape extended; no SQL migration required.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatMessage.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md

# Date
- 2026-02-24
