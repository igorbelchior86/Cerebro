# Pipeline Tenant/Org Boundary + Entity Resolution + EvidenceDigest Gates
# What changed
- Extended shared pipeline contracts in `@playbook-brain/types` to include:
  - tenant/org/workspace scope metadata on evidence artifacts
  - deterministic entity resolution payload (`entity_resolution`)
  - rejected evidence contract (`rejected_evidence`)
  - capability verification contract (`capability_verification`)
  - structured digest contract (`evidence_digest`)
  - quality/coverage gate outputs in validation responses
- Refactored `PrepareContextService` to add:
  - facet detection (`symptom`, `technology`, `entities`) and contextual retrieval boost
  - deterministic actor resolution with weighted matching (`exact_name`, `email`, `phone`, `company_normalized`)
  - org boundary enforcement that moves divergent evidence to `rejected_evidence` with score `0`
  - deterministic capability verification chain for hardware-capacity cases
  - `EvidenceDigest` generation with:
    - `facts_confirmed`
    - `facts_conflicted`
    - `missing_critical`
    - `candidate_actions` (always tied to valid `evidence_refs`)
    - `tech_context_detected`
    - `sources_consulted_by_facet`
    - `rejected_evidence`
- Updated diagnosis and playbook prompt builders to use `EvidenceDigest` as primary grounding input.
- Expanded `ValidatePolicyService` with formal gates:
  - blocking: `cross_tenant_candidate_detected`, `named_entity_unresolved`, `domain_required_source_missing`, `capability_verification_incomplete`
  - coverage: `entity_coverage`, `tech_coverage`, `signal_coverage`, `asset_coverage`
  - generation rule: playbook generation only when status is `approved`
- Added persistence wiring in orchestrator/full-flow validation writes to store gate/coverage context in persisted validation payload fields.
- Added unit tests for quality-gate scenarios (`validate-policy-gates.test.ts`).

# Why it changed
- Previous flow still allowed weak cross-org contamination and unresolved actor context to reach diagnosis/playbook stages.
- Raw evidence packs lacked a strict deterministic digest boundary before LLM calls.
- Hardware capability tickets needed an explicit deterministic verification chain to prevent unsupported conclusions.

# Impact (UI / logic / data)
- UI:
  - No direct layout changes.
  - API payload now carries richer gate and digest metadata that the UI can surface.
- Logic:
  - Context preparation is now tenant/org scoped at artifact level.
  - Evidence with org mismatch is rejected and cannot support hypotheses/actions.
  - Validation becomes a formal quality gate before playbook release.
- Data:
  - JSON payload shape in `evidence_packs` and validation persistence is extended.
  - No mandatory schema migration required for these additions.

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
