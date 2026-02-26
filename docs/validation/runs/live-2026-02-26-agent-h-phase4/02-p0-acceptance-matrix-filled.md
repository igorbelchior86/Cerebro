# P0 Acceptance Matrix (Filled) — Phase 4 Refresh Internal Validation

- Session ID: `refresh-val-2026-02-26-agent-h`
- Date: `2026-02-26`
- Environment: `local/staging-like` (`http://localhost:3001`)
- Tenant ID: `5b5f7e25-2396-4bec-a584-41352be7e876`
- Evidence bundle: `docs/validation/runs/live-2026-02-26-agent-h-phase4/`

## Coverage Matrix (P0) — Filled

| Area | Workflow / Integration | Validation Step(s) | Measurable Pass Criteria | Evidence | Result | Notes / Defect IDs |
|---|---|---|---|---|---|---|
| F0 | Intake & Triage | S1 | AI decision recorded with `confidence`, `rationale`, `signals_used`, `prompt_version`, `model_version`, `correlation`; HITL status consistent with policy | `s1-ai-triage-decision.json`, `s1-s5-ai-decisions-after.json`, `s5-manager-ops-visibility.json` | PASS | Decision `11db79c3-8ab0-4a0f-845e-fc4bbd089ac2` recorded with `confidence=0.58`, `hitl_status=pending`, policy gate reasons = priority_high, confidence_below_0.7, validation_needs_more_info |
| F1 | Dispatch & Routing | S2 | Workflow command accepted with idempotency key; process result visible; audit trail retrievable by ticket; duplicate handling safe | `s2-workflow-command-*.json`, `s2-workflow-audit.json` | PARTIAL | Command accepted + idempotent replay proven; processing failed safely on synthetic ticket (`Autotask API error: 404 Not Found`) so no successful Autotask mutation path proof in this session |
| F2 | Technician Context | S3 | Enrichment envelope contains cards/evidence + provenance + policy; read-only mutation rejected + audited | `s3-enrichment-context.json`, `s3-readonly-rejection-*.json`, `s3-s5-p0-audit-after.json` | PASS | Read-only context envelope built with 4 sources and explicit `403`+audit rejections for IT Glue/Ninja/SentinelOne/Check Point |
| F3 | Handoff & Escalation | S4 | Handoff/summary generated; evidence-backed content review passes; escalation/HITL path explicit for low-confidence/sensitive cases | `s4-handoff-summary-artifact.json`, `s1-ai-triage-decision.json` | PARTIAL | Handoff/summary drafts generated and linked to AI decision provenance; UI/persisted handoff workflow path not exercised in this shell session |
| F4 | Manager Visibility | S5 | Snapshot shows queue/SLA + AI audit + automation audit + QA sampling + integrity checks; manager review completed | `s5-manager-ops-visibility.json`, `04-qa-sampling-results.md` | PARTIAL | Snapshot computed all required sections; integrity checks flagged queue mismatch for sampled AI decision (`DEF-H-002`) and QA sample volume under recommended minimum |
| Integration | Autotask (two-way) | S2 + sync/reconcile spot checks | Command/sync/reconcile endpoints operate for test tickets; policy allows intended command path; audit/correlation present | `s2-workflow-command-*.json`, `s2-workflow-audit.json`, `s2-autotask-sync.json`, `s2-autotask-reconcile.json` | PARTIAL | Command path and sync path exercised with audit/correlation. Reconcile returned `500` due upstream `429` (`DEF-H-001`). No successful live two-way write on a real ticket demonstrated |
| Integration | IT Glue (read-only) | S3 | Context available when data present; no write allowed; explicit reject + audit on mutation test | `s3-enrichment-context.json`, `s3-readonly-rejection-itglue.json`, `s3-s5-p0-audit-after.json` | PASS | Read-only enforced and audited |
| Integration | Ninja (read-only) | S3 | Context available when data present; no write allowed; explicit reject + audit on mutation test | `s3-enrichment-context.json`, `s3-readonly-rejection-ninja.json`, `s3-s5-p0-audit-after.json` | PASS | Read-only enforced and audited |
| Integration | SentinelOne (read-only) | S3 | Context available when data present; no write allowed; explicit reject + audit on mutation test | `s3-enrichment-context.json`, `s3-readonly-rejection-sentinelone.json`, `s3-s5-p0-audit-after.json` | PASS | Read-only enforced and audited |
| Integration | Check Point (read-only) | S3 | Context available when data present; no write allowed; explicit reject + audit on mutation test | `s3-enrichment-context.json`, `s3-readonly-rejection-checkpoint.json`, `s3-s5-p0-audit-after.json` | PASS | Read-only enforced and audited |
| Platform/NFR | Tenant isolation | S1-S5 (sample checks) | No cross-tenant data in workflow/AI/audit snapshots; integrity checks clean for tenant scope | `s1-s5-ai-decisions-after.json`, `s3-s5-p0-audit-after.json`, `s5-manager-ops-visibility.json` | PASS | Sampled records consistently scoped to tenant `5b5f7e25-2396-4bec-a584-41352be7e876`; no cross-tenant payload observed |
| Platform/NFR | Auditability / provenance | S1-S5 | AI + read-only enforcement + workflow actions have traceable IDs/timestamps/correlation/provenance | `s1-ai-triage-decision.json`, `s2-workflow-audit.json`, `s3-s5-p0-audit-after.json` | PASS | Provenance/correlation fields present across AI decisions, workflow audits, and read-only rejections |
| Platform/NFR | Retry/DLQ / degraded mode signals | S2/S3 + log check | Failure/retry or degraded behavior observable and documented; no silent fail-open unsafe writes | `s2-workflow-command-process.json`, `s2-workflow-command-status.json`, `s2-autotask-reconcile.json`, `s2-workflow-audit.json` | PARTIAL | Command failure surfaced + audited (no silent write). Reconcile upstream `429` surfaced as `500` and no bounded degraded response proof (`DEF-H-001`) |
| Platform/NFR | Observability correlation | S2/S5 | `x-correlation-id`/trace linkage appears in API-level evidence and/or logs for sampled flows | `headers-workflow-inbox.txt`, `headers-manager-visibility.txt`, `s2-workflow-audit.json` | PASS | Response headers echo correlation IDs (`x-request-id`/`x-trace-id`) and workflow audit records retain `trace_id`/`job_id` |

## Acceptance Summary (Session Draft)

- Hard gates passed? `No` (Autotask two-way launch-use-case success not demonstrated end-to-end; F4 snapshot integrity flagged mismatch)
- Weighted readiness score (0-100): `75.1` (draft)
- Recommended interpretation: `CONDITIONAL (short hardening loop)`

### Scoring Notes (draft)
- Workflows F0-F4: `42 / 60`
- Launch integrations: `20 / 25` (Autotask `PARTIAL`; 4 read-only integrations `PASS`)
- Platform/NFR signals: `13.1 / 15` (retry/degraded path `PARTIAL`)
