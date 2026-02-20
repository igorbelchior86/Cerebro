# PrepareContext Full Ticket Signal Utilization and Org Boundary Hardening
# What changed
- Updated email-ticket fetch in `PrepareContextService` to read and propagate `raw_body` and parsed `updates` into ticket context.
- Introduced unified `ticketNarrative` composition (`title + description + company + requester + rawBody + updates`) and reused it for:
  - company inference
  - facet detection
  - IT Glue org resolution hints
  - deterministic device resolution
  - entity resolution
  - capability verification input
  - related-case search terms
- Fixed deterministic entity scoring bug where `company_normalized` previously added constant score even without company evidence.
- Hardened org boundary enforcement:
  - org-scoped evidence is now rejected with `invalid_source_scope` when target org is unresolved.
  - unresolved org scope is emitted as `missing_data` (`org_scope_unresolved`).
- Added deterministic phone provider inference (pre-LLM) from ticket + docs + configs + passwords + signals.
- Added inferred provider to source findings and evidence digest (`facts_confirmed` and `tech_context_detected`).
- Updated validation quality gate detection to treat `invalid_source_scope` as contamination blocker.
- Added regression tests for:
  - ticket narrative coverage of raw body/updates
  - company score evidence behavior
  - org boundary unresolved target rejection
  - phone provider inference
  - validation blocking on `invalid_source_scope`

# Why it changed
- The pipeline had data asymmetry: sidebar/card could show company from raw ticket body while evidence preparation ignored that same signal path.
- Entity resolution had inflated candidate scores due non-evidence-based company weight.
- Org-boundary logic was permissive when target org was missing, allowing possible contamination.
- Telephony/provider inference had no deterministic path despite available ticket/org evidence.

# Impact (UI / logic / data)
- UI: indirect improvement via better pipeline outputs (fewer mismatches and clearer missing-data states).
- Logic:
  - More complete ticket grounding before LLM.
  - Safer org-scope rejection behavior when scope cannot be resolved.
  - Better deterministic actor/provider inference quality.
- Data:
  - `missing_data` now includes `org_scope_unresolved` and telephony provider gaps when applicable.
  - `source_findings` can include deterministic provider inference evidence.
  - `rejected_evidence` now records `invalid_source_scope` cases.

# Files touched
- apps/api/src/services/prepare-context.ts
- apps/api/src/services/validate-policy.ts
- apps/api/src/__tests__/services/prepare-context-device-resolution.test.ts
- apps/api/src/__tests__/services/validate-policy-gates.test.ts

# Date
- 2026-02-20
