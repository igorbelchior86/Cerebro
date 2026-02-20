# 2026-02-20 PrepareContext Full Ticket Signal Utilization and Org Boundary Hardening
# What changed
- `PrepareContextService` now loads `raw_body` from `tickets_processed` and uses `rawBody + updates` in unified ticket narrative.
- Replaced partial ticket-text usage with full narrative across context preparation and entity/device resolution paths.
- Corrected entity scoring to only apply `company_normalized` weight when contact company evidence matches.
- Enforced stronger org boundary by rejecting org-scoped evidence when target org is unresolved (`invalid_source_scope`).
- Added deterministic telephony provider inference and persisted resulting signal in findings/digest.
- Validation now treats `invalid_source_scope` rejected evidence as hard contamination gate.
- Added regression coverage in prepare-context and validate-policy tests.

# Why it changed
- To ensure ticket-relevant information is fully utilized by the evidence pipeline while preventing cross-org contamination.

# Impact (UI / logic / data)
- Logic quality and safety gates improved.
- Evidence digest grounding improved for telephony and entity/org scope scenarios.
- Missing-data and rejected-evidence observability improved.

# Files touched
- apps/api/src/services/prepare-context.ts
- apps/api/src/services/validate-policy.ts
- apps/api/src/__tests__/services/prepare-context-device-resolution.test.ts
- apps/api/src/__tests__/services/validate-policy-gates.test.ts

# Date
- 2026-02-20
