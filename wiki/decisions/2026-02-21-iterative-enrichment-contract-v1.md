# Decision: Iterative Enrichment Contract v1 (A-E)
# What changed
- Standardized enrichment output as `iterative_enrichment` v1 with per-field provenance and round chronology.
- Introduced mandatory ticket completeness gate based on canonical section `ticket`.

# Why it changed
- To keep LLM usage in high-value tasks (normalization/inference) while preserving deterministic auditability and release safety.

# Impact (UI / logic / data)
- UI: can consume a single canonical enrichment object.
- Logic: deterministic block condition for incomplete mandatory ticket context.
- Data: evidence payload shape expanded without DB migration.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/packages/types/src/index.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/validate-policy.ts

# Date
- 2026-02-21
