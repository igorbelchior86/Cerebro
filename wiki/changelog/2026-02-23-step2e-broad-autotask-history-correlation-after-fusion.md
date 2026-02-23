# Step 2E Broad Autotask History Correlation After Fusion
# What changed
- Added a new broad history correlation pass (`round 8`) in `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts` that runs after cross-source fusion (`2d`).
- The new pass builds weighted search terms from fused enrichment fields (user/device/network/infra), ticket normalized data, software hints, domains, IT Glue document titles, and `fusion_audit` links/inferences/resolutions.
- Replaced single-keyword history matching behavior with a local scored search over approved triage sessions (`Autotask/email fallback`) using multiple weighted terms.
- Recomputed final `related_cases`, `evidence_digest`, and `iterative_enrichment.rounds` after the broad history pass so the final Evidence Pack/UI reflects the enriched history results.

# Why it changed
- The previous history step searched using a single keyword and missed correlation patterns that depend on multiple current-context signals (user aliases, device names, software mentions, ISP/network components, domains).
- The contract for `2e` requires a broad search for past cases involving current items, using the data assembled from earlier steps.

# Impact (UI / logic / data)
- UI: `related_cases` shown via the Evidence Pack can now reflect stronger historical matches after fusion-based enrichment.
- Logic: History correlation is now multi-term, weighted, and scored (not literal single-keyword lookup), and runs again after fused context is available.
- Data: No schema changes. `source_findings` gains `round 8` entry `history_correlation_broad`; `iterative_enrichment.rounds` includes `history_correlation_broad`.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`

# Date
- 2026-02-23
