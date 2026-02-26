# Evidence Capture Procedure (Phase 4 Refresh Validation)

## Goal

Produce repo-native artifacts (JSON snapshots + notes) that support reproducible validation scoring and a documented launch/no-launch decision.

## Evidence Bundle Layout (recommended)

```
docs/validation/runs/<timestamp>/
  manifest.json
  health.json
  workflow-inbox.json
  workflow-reconciliation-issues.json
  manager-ops-ai-decisions.json
  manager-ops-audit.json
  manager-ops-visibility.json           # if queue items supplied
  logs/
    api-correlation-samples.md          # optional manual capture
  qa/
    ai-sample-review-notes.md           # manual reviewer notes
  defects/
    defect-log.md                       # using triage template
  decision/
    launch-decision-packet.md           # using template
```

## Capture Modes

### A. Scripted (preferred)

Use `scripts/p0-validation-evidence-capture.mjs` to export API snapshots.

Example (dry-run rehearsal):

```bash
node scripts/p0-validation-evidence-capture.mjs \
  --dry-run \
  --out-dir docs/validation/runs/dry-run-2026-02-26
```

Example (live capture, authenticated):

```bash
node scripts/p0-validation-evidence-capture.mjs \
  --base-url http://localhost:3001 \
  --token "$CEREBRO_VALIDATION_BEARER" \
  --queue-items-file docs/validation/fixtures/sample-queue-items.json \
  --out-dir docs/validation/runs/refresh-session-01
```

### B. Manual (fallback)

- Call endpoints via UI/Postman/curl
- Save JSON responses into the same bundle layout
- Record request timestamp, actor role, tenant, and correlation IDs used

## Minimum Endpoint Snapshot Set (P0)

- `GET /health`
- `GET /workflow/inbox`
- `GET /workflow/reconciliation-issues`
- `GET /manager-ops/p0/ai-decisions`
- `GET /manager-ops/p0/audit`
- `POST /manager-ops/p0/visibility` (with representative `queue_items` payload)

Optional scenario-specific captures:
- `POST /workflow/commands`
- `GET /workflow/commands/:commandId`
- `GET /workflow/audit/:ticketId`
- `POST /manager-ops/p0/enrichment/context`
- `POST /manager-ops/p0/enrichment/mutate/:source` (expected `403` + audit)

## Evidence Quality Requirements

- Every saved file includes capture timestamp (either payload timestamp or `manifest.json` metadata)
- Session notes map evidence files to matrix rows (`F0-F4`, integrations, NFRs)
- AI quality review includes decision IDs and reviewer outcome (`Accept/Edit/Reject`)
- Audit/provenance checks include `prompt_version`, `model_version`, `correlation`, and integration provenance refs (when applicable)

## Correlation ID Practice (recommended)

Use a stable session prefix in `x-correlation-id` for scenario calls, e.g.:
- `refresh-val-20260226-s1`
- `refresh-val-20260226-s2`

This improves trace/log retrieval and defect repro precision.
