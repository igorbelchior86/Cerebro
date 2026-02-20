# Changelog: PrepareContext Iterative Cross-Correlation
# What changed
- Introduced round-based source findings for PrepareContext (`R1`, `R2`, `R3`).
- Added historical back-pass correlation with enriched terms from device/user/doc context.
- Added Ninja logged-in-user heuristic from device details.
- Updated timeline rendering to include round prefix and iterative context copy.

# Why it changed
- Move from linear/source-generic messages to real back-and-forth crossing visibility.

# Impact (UI / logic / data)
- UI: Center timeline item 2 now reflects iterative pipeline order.
- Logic: PrepareContext now revisits sources after enrichment instead of single-pass only.
- Data: Optional `round` added in `source_findings` contract.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/packages/types/src/index.ts

# Date
- 2026-02-20
