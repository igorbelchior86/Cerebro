# Hypotheses Evidence Popover
# What changed
- Removed inline evidence chips from hypothesis cards.
- Added info button (`i`) at top-right of each hypothesis card.
- Clicking/tapping opens a popover with full evidence text (human explanation) and technical evidence ID per item.
- Kept evidence mapping from hypothesis references to `evidence_digest.facts_confirmed` text.

# Why it changed
- Inline chips were visually noisy and still hard to interpret in context.
- Popover pattern keeps cards clean while preserving full evidence traceability on demand.

# Impact (UI / logic / data)
- UI: cleaner hypothesis cards with expandable evidence details.
- Logic: frontend-only interaction/state for evidence visibility.
- Data: unchanged backend payload.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/PlaybookPanel.tsx`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`

# Date
- 2026-02-21
