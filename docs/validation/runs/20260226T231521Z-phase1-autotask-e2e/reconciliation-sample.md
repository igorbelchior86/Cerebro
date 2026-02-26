# Reconciliation Sample

## Live sample from this run
- Ticket: `T20260226.0033`
- Endpoint: `POST /workflow/reconcile/T20260226.0033`
- Result: `matched=true` (HTTP `200`)
- Evidence file: `s2-reconcile-result.json`

## Mismatch remediation reference (documented)
If a future run returns mismatch or upstream throttling:
1. Inspect `workflow.reconciliation.mismatch` / `workflow.reconciliation.fetch_failed` events in `GET /workflow/audit/:ticketId`.
2. Re-run `POST /workflow/sync/autotask` with scoped event and then `POST /workflow/reconcile/:ticketId`.
3. Use classified 429 handling path and evidence baseline documented in:
   - `docs/validation/runs/followup-2026-02-26-agent-j-phase4-remediation/s2-autotask-reconcile-429-classified.json`
   - `docs/validation/runs/followup-2026-02-26-agent-j-phase4-remediation/05-defect-triage-log.md`
