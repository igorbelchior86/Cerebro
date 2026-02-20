# PrepareContext Iterative Cross-Correlation
# What changed
- Reworked `PrepareContext` from single-pass source summary to iterative round-based crossing.
- Implemented explicit rounds:
  - R1: Intake/AT anchors -> IT Glue org context
  - R1: IT Glue/org anchors -> Ninja org/device context
  - R2: Refined terms -> historical case correlation
  - R3: Ninja refinement -> IT Glue refinement
- Added logged-in user extraction heuristic from Ninja device details/properties.
- Added optional `round` field to source findings to encode back-and-forth chronology.
- Updated middle timeline item to display round-prefixed findings (`R1`, `R2`, `R3`).

# Why it changed
- The previous flow looked linear and generic; it did not reflect real iterative crossing between systems.
- Operators need to know exactly how context evolved across source passes.

# Impact (UI / logic / data)
- UI: PrepareContext timeline now communicates iterative correlation sequence.
- Logic: Cross-source loop now revisits historical data with enriched terms and refines device/contact mapping.
- Data: `source_findings` now carries optional `round` metadata (backward compatible).

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/packages/types/src/index.ts

# Date
- 2026-02-20
