# Phase 4 Refresh Internal Validation Framework (P0)

## Purpose

Repo-native validation framework for **Phase 4 — Refresh Internal Validation** (Weeks 12-14) so the founder can run production-like internal sessions, collect evidence, score P0 acceptance, triage defects, and document a launch/no-launch decision.

## Artifact Index

- `01-validation-session-runbook.md`: session checklist, roles, scenarios, pass/fail execution steps
- `02-p0-acceptance-matrix.md`: measurable acceptance matrix for `F0-F4`, launch integrations, and platform/NFR signals
- `03-evidence-capture-procedure.md`: evidence format and capture/export process (manual + script)
- `04-qa-sampling-workflow.md`: AI/HITL sampling workflow and provenance checks
- `05-defect-triage-template.md`: defect intake + severity + go/no-go impact template/rules
- `06-launch-decision-packet-template.md`: launch/no-launch packet template with thresholds and measured outcomes

## Scope Guardrails

- P0 only (`Autotask` two-way; `IT Glue`/`Ninja`/`SentinelOne`/`Check Point` read-only)
- Validation execution and evidence collection only (no feature development)
- Launch/no-launch decision support only (no rollout mechanics)

## Related Routes (source of executable evidence)

- `/workflow/*` (inbox, commands, sync, reconcile, audit)
- `/manager-ops/p0/*` (AI decisions, audit, enrichment context, visibility, read-only rejection checks)

## Notes

- Prefer running after Agent D hardening outputs are merged/stable.
- Evidence capture utility supports `--dry-run` for rehearsal when live stack/admin auth is unavailable.
