# Clean Ticket Text LLM Rich Formatting (Preserve Signature)
# What changed
- Moved `Clean` ticket text rich formatting generation to the LLM normalization step (backend) instead of relying only on frontend heuristics.
- Added a new display artifact field in `ticket_text_artifact` payload:
  - `text_clean_display_markdown`
  - `text_clean_display_format` (`markdown_llm` or `plain`)
- Kept `text_clean` as plain pipeline-clean canonical text for enrichment/search/parsing use.
- Updated the triage UI to prefer/render the LLM markdown in the `Clean` toggle when available.
- Preserved the sender signature/contact block in the LLM display markdown prompt contract.
- Removed the verbose UI prefix (`Cleaned ticket text (noise removed, meaning preserved):`) from the `Clean` toggle payload.

# Why it changed
- Real intake emails contain HTML/template boilerplate, signatures, disclaimers, and merged list structures that are hard to format reliably with local heuristics.
- The user explicitly requested LLM-driven cleanup/rich formatting and clarified that the signature must be preserved.

# Impact (UI / logic / data)
- UI: `Clean` toggle can now render LLM-produced Markdown directly (headings/lists/tables/sections) when flagged as `markdown_llm`.
- Logic: `normalizeTicketForPipeline(...)` now requests both:
  - canonical plain cleaned text for pipeline usage
  - display markdown for technician-facing rendering
- Data: No DB schema migration required (JSON payload extension only in `ticket_text_artifacts.payload`).

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatMessage.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md

# Date
- 2026-02-24
