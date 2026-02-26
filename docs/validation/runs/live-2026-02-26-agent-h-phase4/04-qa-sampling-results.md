# QA Sampling Results — Phase 4 Refresh Internal Validation (Agent H)

## Session Metadata
- Date: `2026-02-26`
- Session ID: `refresh-val-2026-02-26-agent-h`
- Environment: `local/staging-like`
- Tenant ID: `5b5f7e25-2396-4bec-a584-41352be7e876`
- Inputs used:
  - `GET /manager-ops/p0/ai-decisions`
  - `GET /manager-ops/p0/audit`
  - `POST /manager-ops/p0/visibility`
  - `s4-handoff-summary-artifact.json`

## Sampling Outcome
- Snapshot `qa_sampling.sample_size`: `1`
- Reviewed count (actual): `1`
- Recommended target met? `No` (target min `10`; only one decision generated during this API validation session)

## Reviewed Decisions

### QA-001 — `11db79c3-8ab0-4a0f-845e-fc4bbd089ac2` (`ticket_id=VAL-H-S1-001`)
- Reviewer outcome: `ACCEPT`
- Reason for sampling: `HITL pending + Low confidence`
- Decision type: `triage`
- Suggestion-only: `true`
- Confidence: `0.58`
- HITL status: `pending`
- Policy gate outcome: `hitl_required`
- Policy gate reasons: `priority_high, confidence_below_0.7, validation_needs_more_info`
- Prompt/model versions present: `Yes` (`phase4-val-agent-h-triage-v1` / `validation-sim-model-v1`)
- Rationale specific: `Yes` (includes hypothesis, confidence, blocking reason, source count)
- Signals used populated: `Yes` (`6` refs)
- Correlation present: `Yes` (`trace_id`, `job_id`, `ticket_id`)
- Linked summary/handoff drafts present: `Yes` (`s4-handoff-summary-artifact.json`)

## Provenance / Audit Checks
- `correlation.ticket_id == ticket_id`: `Yes`
- `provenance_refs` present: `Yes`
- Manager/audit surfaces can retrieve related records: `Yes` (`/manager-ops/p0/ai-decisions`, `/manager-ops/p0/audit` returned `200`)
- Cross-tenant contamination observed: `No` (sample scope only)

## Session AI KPI (sample-limited)
- Acceptance rate: `1.00` (`1/1`)
- Override rate: `0.00` (`0/1`)
- Pending HITL count (snapshot): `1`
- False-escalation / false-auto-resolve: `Not enough sample volume; not assessed`

## Findings / Gaps
- QA sample volume below recommended threshold; session generated only one AI decision.
- Manager visibility integrity check flagged queue mismatch for sampled AI decision (`DEF-H-002`), which reduced confidence in F4 queue-aligned sampling completeness for this run.
