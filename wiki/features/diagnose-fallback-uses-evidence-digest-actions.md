# Diagnose Fallback Uses Evidence Digest Actions
# What changed
- Updated deterministic fallback diagnosis in `DiagnoseService` to prioritize `evidence_digest.candidate_actions` when present.
- Fallback no longer defaults immediately to the same generic pair of recommended actions for all tickets.
- Added regression test ensuring fallback action list is driven by digest actions.

# Why it changed
- Prevent repeated near-identical playbooks when diagnose step falls back from LLM provider output.
- Keep fallback behavior ticket-grounded and evidence-driven.

# Impact (UI / logic / data)
- UI: playbook variance improves across different tickets in fallback scenarios.
- Logic: fallback recommendations are now contextualized by evidence digest actions.
- Data: no schema changes.

# Files touched
- apps/api/src/services/diagnose.ts
- apps/api/src/__tests__/services/diagnose-fallback-actions.test.ts

# Date
- 2026-02-20
