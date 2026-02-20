# 2026-02-20 Diagnose Fallback Uses Evidence Digest Actions
# What changed
- Deterministic diagnose fallback now uses `evidence_digest.candidate_actions` as recommended actions when available.
- Added regression test to prevent fallback action homogenization.

# Why it changed
- To avoid repeating effectively identical playbooks across unrelated tickets during fallback conditions.

# Impact (UI / logic / data)
- Improved fallback specificity and differentiation per ticket.

# Files touched
- apps/api/src/services/diagnose.ts
- apps/api/src/__tests__/services/diagnose-fallback-actions.test.ts

# Date
- 2026-02-20
