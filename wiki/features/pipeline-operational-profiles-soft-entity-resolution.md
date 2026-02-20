# Pipeline Operational Profiles + Soft Entity Resolution
# What changed
- Added operational validation profiles in `ValidatePolicyService`:
  - `strict`
  - `standard`
  - `lenient`
- Added profile-aware calibration for:
  - hypothesis confidence threshold
  - coverage thresholds (`entity`, `tech`, `signal`, `asset`)
  - quality-gate blocking behavior
- Added hard-stop semantics only for high-risk/core safety failures:
  - risk gates
  - no-evidence gates
  - cross-tenant contamination
  - domain-required-source missing
- Added soft-mode behavior for operational flow:
  - unresolved entity does not hard-block when ticket already has person + email/phone hints
  - capability verification incomplete in non-strict profiles produces guided-collection requirements instead of hard block
- Added soft actor resolution in `PrepareContextService`:
  - parses `FirstName/LastName`, email and phone directly from ticket narrative
  - emits `resolved_actor` with `confidence: medium` when org contact resolution is unavailable but ticket identity is explicit
- Added runtime setting mapping to activate profile from workspace settings:
  - `triageGatingProfile` / `pipelineGatingProfile` -> `TRIAGE_GATING_PROFILE`
- Extended validation tests to cover strict vs standard behavior.

# Why it changed
- Strict deterministic gates were correct for safety, but over-blocked real-world first-pass email tickets, preventing playbook generation even when ticket identity/context were explicit.
- The new profile model preserves safety-critical stops while reducing false negatives in operational flow.

# Impact (UI / logic / data)
- UI:
  - no direct visual changes
  - existing validation payload now reflects profile-aware behavior
- Logic:
  - validation is now profile-calibrated (`strict|standard|lenient`)
  - default behavior is operational (`standard`) unless overridden
  - ticket-level explicit identity can bootstrap a medium-confidence actor resolution
- Data:
  - no schema migration
  - payload semantics changed for `validation_results` and `evidence_pack.entity_resolution`

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/validate-policy.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/runtime-settings.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/validate-policy-gates.test.ts

# Date
- 2026-02-20
