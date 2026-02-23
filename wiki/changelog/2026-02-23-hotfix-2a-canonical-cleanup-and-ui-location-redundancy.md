# Hotfix 2A Canonical Cleanup And UI Location Redundancy
# What changed
- Added deterministic post-processing for `2a` ticket normalization in `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`:
  - strips HTML remnants, safelinks/URLs, Autotask portal boilerplate, acknowledgements, signatures, and external-email caution/disclaimer blocks
  - sanitizes `description_canonical` even when the LLM output is overly permissive
  - trims UI reinterpretation text (`description_ui`) to avoid wrapper-like content if returned by the model
- Fixed center-column Autotask message composition in `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx` to avoid redundant location display when `site` duplicates `requester` or `org`.

# Why it changed
- For `T20260223.0006`, the LLM-generated `text_clean` still contained too much boilerplate/disclaimer noise, violating the `2a` cleanup intent.
- The UI also produced a redundant `org, site` string (`CAT Resources, LLC, Nick Ryals`) because `site` collapsed to requester fallback.

# Impact (UI / logic / data)
- UI: Cleaner intake message line and less redundant location text.
- Logic: `2a` canonical cleanup is now robust even when LLM output quality drifts.
- Data: `ticket_text_artifacts.text_clean` should now be significantly cleaner on future runs/reprocesses.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`

# Date
- 2026-02-23
