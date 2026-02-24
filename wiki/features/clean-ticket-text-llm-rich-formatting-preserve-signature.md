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
- Follow-up hardening: display markdown generation is now constrained to **format-only** changes (no paraphrase / no reinterpretation).
- Added a verbatim-preservation validator plus a strict LLM retry path for formatting-only output before plain fallback.
- Follow-up bugfix: relaxed the validator to tolerate small formatting-only label/header additions so valid rich formatting is not falsely downgraded to plain text.
- Final simplification: rich display markdown is now generated in a **separate strict format-only LLM call** over the already-clean canonical text (instead of sharing the normalization prompt with `description_ui`).
- Follow-up prompt fix: the format-only prompt now permits **minimal generic labels/headings** (e.g. `Request`, `Signature`) so the `Clean` view can be truly rich-formatted while preserving wording.
- Follow-up prompt fix: onboarding-style repeated person rosters now have an explicit table preference rule (`3+ person-like entries => Markdown table`) with `Name | Details` fallback when field extraction is ambiguous.

# Why it changed
- Real intake emails contain HTML/template boilerplate, signatures, disclaimers, and merged list structures that are hard to format reliably with local heuristics.
- The user explicitly requested LLM-driven cleanup/rich formatting and clarified that the signature must be preserved.

# Impact (UI / logic / data)
- UI: `Clean` toggle can now render LLM-produced Markdown directly (headings/lists/tables/sections) when flagged as `markdown_llm`.
- Logic: `normalizeTicketForPipeline(...)` now requests both:
  - canonical plain cleaned text for pipeline usage
  - display markdown for technician-facing rendering
- Logic: LLM display markdown is validated against canonical cleaned text (markdown stripped / normalized) and retried with a stricter prompt if it changes wording.
- Logic: validator now uses high source-token coverage + low novel-token ratio (with a formatting-label allowlist) instead of near-exact equality.
- Logic: display formatting is now decoupled from the normalization/reinterpretation prompt, reducing semantic contamination.
- Logic: formatter prompt preserves wording/facts but allows small structural labels for readability.
- Logic: formatter prompt now encodes a concrete roster-table trigger for more consistent output across similar onboarding tickets.
- Data: No DB schema migration required (JSON payload extension only in `ticket_text_artifacts.payload`).

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatMessage.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md

# Date
- 2026-02-24
