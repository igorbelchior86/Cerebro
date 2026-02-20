# Changelog: Tenant/Org Boundary + Entity Resolution + EvidenceDigest Gates
# What changed
- Added deterministic pre-LLM context hardening in `PrepareContext`:
  - tenant/org/workspace-scoped evidence metadata
  - weighted actor/entity resolution
  - org-boundary rejection flow (`rejected_evidence` with `evidence_score=0`)
  - facet-aware retrieval and capability-verification metadata
  - structured `EvidenceDigest` generation
- Switched Diagnose/Playbook prompt grounding to `EvidenceDigest` as primary context.
- Implemented quality/coverage gates in validation with strict release rule (`safe_to_generate_playbook` only when `approved`).
- Persisted gate/coverage context in validation persistence paths.
- Added tests for new validation quality gates.

# Why it changed
- Prevent cross-org evidence contamination and unresolved-entity decisions from propagating to playbook outputs.
- Enforce deterministic evidence gating before LLM reasoning and final action recommendations.

# Impact (UI / logic / data)
- UI: no direct visual changes; richer gate metadata is now available for display.
- Logic: stricter boundary + gate enforcement, deterministic capability checks for hardware-capacity tickets.
- Data: extended JSON payload contracts for evidence/validation outputs; no required schema migration.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/packages/types/src/index.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/diagnose.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/playbook-writer.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/validate-policy.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/triage-orchestrator.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/playbook.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/validate-policy-gates.test.ts

# Date
- 2026-02-20
