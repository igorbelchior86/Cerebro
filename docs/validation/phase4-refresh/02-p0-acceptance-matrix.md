# P0 Acceptance Matrix (Phase 4 Refresh Internal Validation)

## Scoring Rules

- `PASS`: criteria met with evidence attached
- `PARTIAL`: usable but gaps/instability remain; defect(s) logged
- `FAIL`: critical criteria not met or unsafe behavior observed
- `BLOCKED`: cannot validate due environment/data/access dependency (must log blocker)

## Coverage Matrix (P0)

| Area | Workflow / Integration | Validation Step(s) | Measurable Pass Criteria | Evidence | Result | Notes / Defect IDs |
|---|---|---|---|---|---|---|
| F0 | Intake & Triage | S1 | AI decision recorded with `confidence`, `rationale`, `signals_used`, `prompt_version`, `model_version`, `correlation`; HITL status consistent with policy | AI decision snapshot + manager visibility |  |  |
| F1 | Dispatch & Routing | S2 | Workflow command accepted with idempotency key; process result visible; audit trail retrievable by ticket; duplicate handling safe | Workflow command/audit snapshots |  |  |
| F2 | Technician Context | S3 | Enrichment envelope contains cards/evidence + provenance + policy; read-only mutation rejected + audited | Enrichment context + read-only rejection + audit |  |  |
| F3 | Handoff & Escalation | S4 | Handoff/summary generated; evidence-backed content review passes; escalation/HITL path explicit for low-confidence/sensitive cases | Handoff artifact + AI decision linkage |  |  |
| F4 | Manager Visibility | S5 | Snapshot shows queue/SLA + AI audit + automation audit + QA sampling + integrity checks; manager review completed | Visibility snapshot + review notes |  |  |
| Integration | Autotask (two-way) | S2 + sync/reconcile spot checks | Command/sync/reconcile endpoints operate for test tickets; policy allows intended command path; audit/correlation present | Workflow command/sync/reconcile snapshots |  |  |
| Integration | IT Glue (read-only) | S3 | Context available when data present; no write allowed; explicit reject + audit on mutation test | Context + rejection audit |  |  |
| Integration | Ninja (read-only) | S3 | Context available when data present; no write allowed; explicit reject + audit on mutation test | Context + rejection audit |  |  |
| Integration | SentinelOne (read-only) | S3 | Context available when data present; no write allowed; explicit reject + audit on mutation test | Context + rejection audit |  |  |
| Integration | Check Point (read-only) | S3 | Context available when data present; no write allowed; explicit reject + audit on mutation test | Context + rejection audit |  |  |
| Platform/NFR | Tenant isolation | S1-S5 (sample checks) | No cross-tenant data in workflow/AI/audit snapshots; integrity checks clean for tenant scope | Snapshots + QA review notes |  |  |
| Platform/NFR | Auditability / provenance | S1-S5 | AI + read-only enforcement + workflow actions have traceable IDs/timestamps/correlation/provenance | Snapshots + defect log |  |  |
| Platform/NFR | Retry/DLQ / degraded mode signals | S2/S3 + log check | Failure/retry or degraded behavior observable and documented; no silent fail-open unsafe writes | Logs + workflow/reconcile evidence |  |  |
| Platform/NFR | Observability correlation | S2/S5 | `x-correlation-id`/trace linkage appears in API-level evidence and/or logs for sampled flows | Request log excerpts + JSON snapshots |  |  |

## Acceptance Summary Thresholds (recommended for launch decision packet)

### Hard Gates (must pass)

- `F0-F4` are not `FAIL`
- `Autotask` two-way path not `FAIL`
- All non-Autotask integrations remain read-only (rejection + audit proven at least once)
- No tenant isolation breach
- No unaudited AI action/autonomous unsafe behavior observed

### Weighted Readiness Score (0-100)

- Workflows `F0-F4`: 60 points total (12 each)
- Launch integrations behavior: 25 points total (`Autotask` 10, each read-only integration 3.75 shared/rounded by reviewer)
- Platform/NFR signals: 15 points total

Scoring method:
- `PASS` = full points
- `PARTIAL` = 50% points
- `FAIL`/`BLOCKED` = 0 points (unless blocker is external-only and founder explicitly excludes from session score)

Recommended interpretation:
- `>= 85` and no hard-gate failures: launch candidate (pending triage of non-blocking defects)
- `70-84`: conditional no-launch / short hardening loop
- `< 70`: no-launch
