# Iterative Enrichment Canonical A-E Contract and Mandatory Ticket Gate
# What changed
- Extended `@playbook-brain/types` with a versioned iterative enrichment contract:
  - `iterative_enrichment.schema_version`
  - canonical sections `ticket`, `identity`, `endpoint`, `network`, `infra`
  - per-field envelope (`value`, `status`, `confidence`, `source_system`, `source_ref`, `observed_at`, `round`)
  - round summaries and coverage metrics.
- Updated `PrepareContextService` to populate `evidence_pack.iterative_enrichment` from cumulative rounds using existing deterministic evidence paths.
- Added external refinement chronology (`source_findings.round = 4`) and generated `network_stack` from the canonical enrichment output.
- Added `mandatory_ticket_fields_missing` to validation quality gates and blocking reasons in `ValidatePolicyService`.
- Added unit tests for:
  - canonical ticket fallback (`affected_user_*` copied from requester when unresolved)
  - network enrichment inference (VPN/provider)
  - iterative enrichment round summary generation
  - validation blocking when mandatory ticket fields are unknown.

# Why it changed
- The pipeline already had iterative crossing and SSOT principles, but lacked a strict canonical A-E output contract that could be audited per field and per round.
- A deterministic gate was needed to prevent playbook generation when mandatory ticket identity context is incomplete in the canonical block.

# Impact (UI / logic / data)
- UI:
  - No direct layout change.
  - Backend now exposes a canonical enrichment payload that can populate UI fields without ad-hoc merges.
- Logic:
  - Enrichment becomes explicit and auditable by field status/confidence/source/round.
  - Validation can hard-stop generation when mandatory ticket fields are missing in canonical enrichment.
- Data:
  - `evidence_packs.payload` now optionally includes `iterative_enrichment` and richer gate metadata.
  - No database migration required.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/packages/types/src/index.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/validate-policy.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/prepare-context-device-resolution.test.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/validate-policy-gates.test.ts

# Date
- 2026-02-21
