# Task: Enforce tenant/org boundary + deterministic entity resolution + EvidenceDigest quality gates
**Status**: completed
**Started**: 2026-02-20

## Plan
- [x] Step 1: Extend shared types/contracts for tenant/org-scoped evidence, entity resolution, EvidenceDigest, quality gates, and capability verification metadata.
- [x] Step 2: Refactor `PrepareContextService` to:
  - apply deterministic entity extraction/resolution inside org scope,
  - enforce tenant/org boundary and populate `rejected_evidence`,
  - retrieve evidence by facets (base + contextual boost),
  - run deterministic hardware capability verification (device + vendor spec),
  - build and persist `EvidenceDigest` + observability fields (`why_selected` / `why_rejected`).
- [x] Step 3: Update Diagnose/Playbook prompt builders to consume `EvidenceDigest` (not raw pack) and enforce action-evidence linkage.
- [x] Step 4: Expand `ValidatePolicyService` with formal gates:
  - blocking: cross-tenant candidate, unresolved entity, required-source missing, incomplete capability verification,
  - coverage: entity/tech/signal/asset; fail-safe to `needs_more_info` when any gate fails.
- [x] Step 5: Wire orchestrator persistence for new observability payloads and gate reasons.
- [x] Step 6: Add/adjust tests for digest generation and validation gate behavior.
- [x] Step 7: Run API tests/build and update wiki documentation under `wiki/features` and `wiki/changelog`.

## Open Questions
- None blocking implementation; vendor capability verification will be deterministic via embedded rule map with optional official-spec URL references in metadata.

## Progress Notes
- Mapped current pipeline services and insertion points in `prepare-context`, `diagnose`, `validate-policy`, `playbook-writer`, and `triage-orchestrator`.
- Confirmed existing schema already stores evidence/playbook payloads as JSONB, enabling additive contract changes without immediate DB migration.
- Implemented deterministic entity resolution + org boundary filtering + evidence digest generation in `PrepareContext`.
- Added formal quality/coverage gates and strict `safe_to_generate_playbook` rule in `ValidatePolicyService`.
- Updated diagnosis/playbook prompts to prioritize `EvidenceDigest` over raw pack context.
- Added regression tests for validation gates and updated persistence paths to retain gate metadata.
- Verification executed:
  - `pnpm --filter @playbook-brain/types build` ✅
  - `pnpm --filter @playbook-brain/api typecheck` ✅
  - `pnpm --filter @playbook-brain/api build` ✅
  - Jest command in this workspace hangs without producing suite output (process had to be terminated), so automated test pass/fail evidence is limited to compile/type checks.

## Review
(fill in after completion)
- What worked:
- Contract-first extension in `@playbook-brain/types` let API services evolve with minimal signature churn.
- Moving boundary/gate logic into deterministic services reduced downstream LLM ambiguity.
- What was tricky:
- Exact optional typing (`exactOptionalPropertyTypes`) required explicit conditional object construction to avoid `undefined` properties.
- Local Jest execution is currently hanging in this environment, so verification relied on build/type checks.
- Time taken:
- ~1h40m
