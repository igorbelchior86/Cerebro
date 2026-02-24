# 2026-02-24 Clean Ticket Text LLM Rich Formatting (Preserve Signature)
# What changed
- `prepare-context` LLM normalization prompt now returns a rich Markdown display variant (`description_display_markdown`) in addition to canonical plain cleaned text.
- New `ticket_text_artifact` payload fields added (JSON-only, no migration):
  - `text_clean_display_markdown`
  - `text_clean_display_format`
- Triage timeline `Autotask` message now uses the display markdown for the `Clean` toggle when present.
- `ChatMessage` renders `Clean` as direct markdown for `markdown_llm` tickets and falls back to the existing heuristic formatter for plain/legacy tickets.
- The `Clean` toggle payload no longer prepends the verbose `Cleaned ticket text...` label.
- Follow-up hardening: display markdown prompt now explicitly requires **format-only** transformations (no paraphrase / no reinterpretation).
- Added a verbatim guard plus a strict LLM retry formatting path before degrading to plain display text.
- Follow-up bugfix: relaxed the verbatim guard to allow formatting-only label/header additions, preventing false plain-text fallback when rich formatting is otherwise valid.
- Final simplification: moved `description_display_markdown` generation out of the normalization JSON prompt and into a separate strict format-only LLM call over canonical cleaned text.
- Follow-up prompt fix: relaxed the strict formatter prompt to allow minimal generic headings/labels (e.g. `Request`, `Signature`) while still forbidding paraphrase/reinterpretation.
- Follow-up prompt fix: added explicit roster-table preference (`3+ person-like entries`) and ambiguity-safe `Name | Details` table fallback to improve consistency between similar onboarding tickets.

# Why it changed
- Frontend heuristics alone were not robust enough for messy email/Autotask bodies (HTML blobs, disclaimers, duplicated templates, merged rosters).
- User requested LLM-based cleanup/rich formatting and explicitly required preserving the signature/contact block.

# Impact (UI / logic / data)
- UI: Cleaner `Clean` rendering path with LLM-authored Markdown when available; backward-compatible fallback remains.
- Logic: Separation of concerns between pipeline canonical text (`text_clean`) and UI display markdown (`text_clean_display_markdown`).
- Logic: Display markdown is now validated and retried under a stricter verbatim formatting contract to preserve original wording.
- Logic: validator now distinguishes formatting additions vs semantic drift via coverage + novel-token ratio thresholds.
- Logic: formatting and reinterpretation are now isolated in separate LLM tasks (`display markdown` vs `description_ui`).
- Logic: format-only prompt now distinguishes "new structure" (allowed) from "new facts/rewrites" (forbidden).
- Logic: prompt now includes a concrete trigger for table formatting of onboarding rosters, reducing Phase 1/Phase 2 output divergence.
- Data: JSON artifact payload shape extended; no SQL migration required.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatMessage.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md

# Date
- 2026-02-24
