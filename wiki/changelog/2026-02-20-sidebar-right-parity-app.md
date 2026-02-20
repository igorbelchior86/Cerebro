# Sidebar Right Parity on App Runtime
# What changed
- Fixed triage page data normalization to map API `pack` into `evidence_pack` for runtime UI usage.
- Added structured `PlaybookPanel` data wiring (`ticketId`, `context`, `hypotheses`) in the real app page.
- Passed structured `data` prop to `PlaybookPanel` only when present, preserving strict TypeScript optional-property rules.

# Why it changed
- The right sidebar component already supported Context/Hypotheses cards, but the integration page only passed markdown content and read the wrong payload key.
- This prevented visible parity of the expected right-panel items in the actual project runtime.

# Impact (UI / logic / data)
- UI: Right panel now receives and renders structured Context/Hypotheses data in real triage route.
- Logic: Added resilient payload normalization (`evidence_pack ?? pack ?? null`).
- Data: No schema change; frontend mapping only.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx

# Date
- 2026-02-20
