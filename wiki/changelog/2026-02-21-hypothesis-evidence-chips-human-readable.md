# 2026-02-21 Hypothesis Evidence Chips Human Readable
# What changed
- Converted technical evidence IDs in Hypotheses chips to human-readable labels.
- Added mapping for common evidence types (ticket, device, actor, docs, operational signals, conflicts, provider).
- Kept raw technical ID available via tooltip for auditability.

# Why it changed
- Technical IDs were not user-friendly in UI and reduced readability.

# Impact (UI / logic / data)
- UI: Hypotheses section is now human-readable while preserving traceability.
- Logic: display-only mapping; no backend data changes.
- Data: unchanged.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/PlaybookPanel.tsx`

# Date
- 2026-02-21
