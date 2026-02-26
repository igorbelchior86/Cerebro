# QA Sampling Workflow for AI Triage / HITL (Phase 4)

## Objective

Operationalize internal QA review of AI triage decisions and HITL outcomes so validation includes measurable AI quality/audit checks, not only workflow functionality.

## Inputs

- `GET /manager-ops/p0/ai-decisions`
- `POST /manager-ops/p0/visibility` response (`qa_sampling.tickets`)
- Ticket context/handoff artifacts for sampled tickets
- Audit records (`GET /manager-ops/p0/audit`) for linked actions/rejections

## Sampling Method (per validation session)

1. Generate manager visibility snapshot with representative queue items.
2. Review all `HITL pending` decisions in sample output (mandatory coverage).
3. Add all `SLA breached` or `at_risk` tickets that also have AI decisions.
4. Add low-confidence decisions (`confidence < 0.70`) not already sampled.
5. If sample is still under target, add random decisions until target count reached.

Recommended target size:
- Minimum: `10` decisions/session
- Or `20%` of session AI decisions, whichever is larger (cap at `50` for P0 session practicality)

## Reviewer Checklist (per sampled decision)

- [ ] `decision_id` / `ticket_id` recorded
- [ ] `decision_type` appropriate for workflow context (`triage`, `routing`, etc.)
- [ ] `suggestion_only = true` (no implicit auto-action in P0)
- [ ] `confidence` is plausible given evidence quality
- [ ] `rationale` is specific and not generic/boilerplate
- [ ] `signals_used` references real signals (ticket text/history/alerts/KB/etc.)
- [ ] `prompt_version` and `model_version` present
- [ ] `policy_gate.outcome` consistent with confidence/risk conditions
- [ ] `hitl_status` matches actual review state
- [ ] Linked handoff/summary (if present) is evidence-backed and safe

## Provenance / Audit Checks (mandatory)

For each sampled decision, confirm:
- `correlation.ticket_id == ticket_id` when present
- `provenance_refs` exist for the decision path (where expected)
- Manager/audit surfaces can retrieve related records (or document gap)
- No cross-tenant records appear in sample set

## Reviewer Outcome Labels

- `ACCEPT`: safe + useful recommendation, no meaningful edits required
- `EDIT`: directionally correct but needed operator correction
- `REJECT`: unsafe, incorrect, or non-actionable recommendation
- `BLOCKED`: insufficient evidence/provenance to evaluate

## Session AI KPI Computation (P0 validation)

Compute from sample outcomes and snapshot counts:
- Acceptance rate = `ACCEPT / (ACCEPT + EDIT + REJECT)`
- Override rate = `(EDIT + REJECT) / reviewed`
- HITL pending aging count = from manager review notes (manual) + `pending_hitl` snapshot count
- False-escalation / false-auto-resolve = manual classification for sampled applicable decisions (P0 may be sparse; document denominator)

## Escalation / Defect Triggers

Create defect(s) immediately when:
- Missing `prompt_version` or `model_version`
- Missing `rationale` or `signals_used`
- Policy gate/HITL mismatch
- Suggestion implies unsafe action contrary to P0 policy
- Cross-tenant evidence or audit record contamination
