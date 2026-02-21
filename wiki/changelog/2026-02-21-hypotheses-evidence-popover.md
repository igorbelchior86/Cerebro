# 2026-02-21 Hypotheses Evidence Popover
# What changed
- Replaced evidence chips with per-card info popover.
- Popover shows full-text evidence and raw reference ID.
- Updated fact mapping to keep full (non-truncated) evidence text.

# Why it changed
- Improve readability and reduce visual clutter in hypothesis area.

# Impact (UI / logic / data)
- UI: evidence now accessible on-demand.
- Logic: frontend display behavior only.
- Data: unchanged.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/PlaybookPanel.tsx`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `/Users/igorbelchior/Documents/Github/Cerebro/wiki/features/hypotheses-evidence-popover.md`

# Date
- 2026-02-21
