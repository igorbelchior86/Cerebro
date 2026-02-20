# Center Timeline: PrepareContext Source Rundown
# What changed
- Timeline item 2 (`PrepareContext`) is now always rendered in center bar.
- Added dynamic source rundown generation using available evidence pack data:
  - Autotask: related cases count
  - NinjaOne: check count and warning count
  - IT Glue: runbook/doc title when available
  - External: provider and status when available
- Added fallback labels when evidence pack is partial/missing for legacy done tickets.

# Why it changed
- The mockup requires a deterministic second timeline item that explains which sources were queried and what was crossed.
- Conditional rendering was causing this item to disappear for some tickets.

# Impact (UI / logic / data)
- UI: PrepareContext item now consistently appears with actionable source rundown.
- Logic: Dynamic enrichment from `evidence_pack` with graceful fallback path.
- Data: No schema changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx

# Date
- 2026-02-20
