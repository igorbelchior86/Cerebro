# Center Refresh Rerun Pipeline
# What changed
- Added a `Refresh` button in the center column header, to the right of the `Playbook Ready` badge.
- Added forced refresh support in `/playbook/full-flow` via `refresh=1|true`.
- Forced refresh clears ticket/session artifacts and resets session status to `pending`, then background pipeline runs again.

# Why it changed
- Users need an explicit way to reset UI and re-run the full pipeline for the current ticket.
- This avoids manual DB resets and keeps reprocessing deterministic.

# Impact (UI / logic / data)
- UI: one-click refresh in center header; local timeline/state resets immediately.
- Logic: API now supports forced full-flow reset and rerun.
- Data: `playbooks`, `llm_outputs`, `validation_results`, `evidence_packs`, `ticket_ssot` are cleared for the target ticket/session on forced refresh.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/playbook.ts

# Date
- 2026-02-23
