# 2026-02-21 Hypothesis Chips Fact-Based Labels
# What changed
- Hypothesis evidence chips now prefer evidence digest fact text (`facts_confirmed[].fact`) over technical IDs.
- Added concise fact summarization and deduplication for repeated chips.
- Technical evidence ID remains available in tooltip.

# Why it changed
- Generic labels were human-readable but semantically empty when repeated.
- Operators need meaningful evidence context directly on chips.

# Impact (UI / logic / data)
- UI: chips now communicate actual supporting facts.
- Logic: frontend maps hypothesis evidence IDs to digest facts.
- Data: unchanged backend payload.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/PlaybookPanel.tsx`

# Date
- 2026-02-21
