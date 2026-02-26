# Phase 4 Refresh Validation Session Runbook (P0)

## Objective

Run a repeatable internal validation session with Refresh technicians/managers to verify P0 workflows and collect evidence for a launch/no-launch decision.

## Participants (minimum)

- Founder/operator (session lead, timing, defect triage owner)
- 1 manager/dispatcher (F1/F4 validation + SLA/queue review)
- 1 technician (F0/F2/F3 execution)
- Optional observer/QA note-taker

## Preconditions (must be checked before session start)

- API stack reachable (`/health` responds)
- Authenticated test users available: technician + manager/admin
- Tenant-scoped credentials configured for launch integrations
- Launch policy preserved: `Autotask` two-way; all others read-only
- P0 targeted tests/typecheck baseline status recorded (reference commit + known exceptions if any)
- Validation evidence folder created for the session (`docs/validation/runs/<timestamp>/` or script output directory)

## Session Artifacts to Produce

- Acceptance matrix scorecard (filled)
- Evidence snapshot bundle (JSON + logs/screenshots as available)
- QA sample review notes for AI/HITL decisions
- Defect triage log (with severity + go/no-go impact)
- Launch/no-launch packet draft

## Scenario Set (minimum execution)

### Scenario S1 — F0 Intake & Triage (AI suggestion + HITL)

Steps:
1. Open/create a ticket in Cerebro workflow path for the validation tenant.
2. Trigger AI triage suggestion (`/manager-ops/p0/ai/triage-decision` path or UI flow that records equivalent decision).
3. Confirm confidence, rationale, signals, prompt/model versions, and HITL status are present.
4. If low confidence/high priority, confirm HITL is marked pending and visible to manager review surfaces.

Pass criteria:
- AI decision record exists with audit provenance fields (`prompt_version`, `model_version`, `correlation`, `signals_used`)
- HITL policy behavior matches threshold/condition expectations
- No tenant leakage in records/evidence

Evidence:
- `ai-decisions.json`, `manager-ops-visibility.json`, UI screenshot (optional), decision IDs

### Scenario S2 — F1 Dispatch & Routing (Autotask two-way command path)

Steps:
1. Submit a workflow command via `/workflow/commands` (assign/reassign/priority/comment use cases as available in current path).
2. Confirm idempotency key required and command accepted.
3. Process worker path (`auto_process` or `/workflow/commands/process`).
4. Inspect `/workflow/commands/:id` and `/workflow/audit/:ticketId`.

Pass criteria:
- Command accepted and tracked with correlation metadata
- Duplicate command attempt with same idempotency key is safely handled (no duplicate unsafe side effect)
- Audit trail exists for command execution or explicit failure/retry

Evidence:
- `workflow-command-*.json`, `workflow-command-status-*.json`, `workflow-audit-<ticket>.json`

### Scenario S3 — F2 Technician Context (read-only enrichment across launch integrations)

Steps:
1. Request P0 context envelope with provider payloads or run UI path that populates enriched context.
2. Verify cards/evidence generated for `IT Glue`, `Ninja`, `SentinelOne`, `Check Point` (where data available).
3. Attempt a mutation on a read-only integration via `/manager-ops/p0/enrichment/mutate/:source` (safe validation attempt).

Pass criteria:
- Context envelope includes provenance and read-only enforcement policy
- Partial failure/degraded mode (if simulated) preserves core ticket handling flag
- Mutation attempt is explicitly rejected (`403`) and audited

Evidence:
- `enrichment-context.json`, `read-only-rejection-*.json`, `audit-readonly.json`

### Scenario S4 — F3 Handoff & Escalation (AI summary + evidence-backed handoff)

Steps:
1. Generate handoff/summary in the current workflow path (UI or equivalent service/API path that stores AI decision record/handoff artifacts).
2. Confirm summary references real evidence/context and not unaudited claims.
3. Validate escalation/HITL conditions for sensitive or low-confidence cases.

Pass criteria:
- Summary/handoff artifact is produced for the test ticket
- AI provenance and confidence are traceable to recorded decision(s)
- Escalation path is explicit when confidence/risk thresholds require it

Evidence:
- Handoff output (screenshot/markdown export), linked `ai-decisions.json`, review notes

### Scenario S5 — F4 Manager Visibility (queue/SLA/audit + QA sample)

Steps:
1. Build manager snapshot via `/manager-ops/p0/visibility` with representative queue items.
2. Review queue/SLA rollup, AI audit metrics, automation audit metrics, QA sampling tickets, integrity checks.
3. Manager reviews at least one HITL pending item and one read-only rejection audit sample.

Pass criteria:
- Snapshot renders measurable counts (`total_tickets`, `pending_hitl`, `avg_confidence`, `read_only_rejections`)
- QA sample list includes reason-based prioritization (HITL/SLA/low-confidence)
- Integrity checks report no critical cross-tenant/auditability issues

Evidence:
- `manager-ops-visibility.json`, reviewed sample ticket IDs, defect entries if any

## Session Timing (recommended 90–120 min)

- 10 min: preflight + auth + evidence folder setup
- 60–90 min: scenario execution (`S1-S5`)
- 20 min: defect triage + scorecard + go/no-go packet draft

## Session Checklist (runnable)

- [ ] Preconditions verified and recorded
- [ ] S1 executed with evidence captured
- [ ] S2 executed with evidence captured
- [ ] S3 executed with evidence captured
- [ ] S4 executed with evidence captured
- [ ] S5 executed with evidence captured
- [ ] Acceptance matrix scored for `F0-F4`
- [ ] Integration policy validations recorded (Autotask two-way / others read-only)
- [ ] QA sampling review completed with provenance checks
- [ ] Defects triaged with severity and go/no-go impact
- [ ] Launch/no-launch packet draft completed
