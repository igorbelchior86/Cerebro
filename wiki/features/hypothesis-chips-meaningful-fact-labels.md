# Hypothesis Chips Meaningful Fact Labels
# What changed
- Added evidence-ID -> fact-text mapping in triage page.
- Updated playbook panel chips to accept structured evidence labels.
- Added deduping to prevent repeated nonsensical chip labels.

# Why it changed
- Improve semantic clarity of hypothesis evidence in UI.

# Impact (UI / logic / data)
- UI: evidence chips now display useful fact summaries.
- Logic: frontend-only transformation.
- Data: no schema changes.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/PlaybookPanel.tsx`

# Date
- 2026-02-21
