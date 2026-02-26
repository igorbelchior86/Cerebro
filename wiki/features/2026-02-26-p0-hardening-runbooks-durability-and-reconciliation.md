# Title
P0 Hardening Runbooks: workflow durability, Autotask poller sync, degraded mode and reconciliation triage

# What changed
- Added internal operator-facing runbooks for P0 hardening scenarios:
  - Autotask sync failure
  - enrichment partial failure
  - reconciliation divergence
  - DLQ triage
- Documented new local runtime state durability files and validation expectations.

# Why it changed
- Internal validation readiness requires reproducible triage steps when cross-agent flows degrade or diverge.
- P0 runtime state is now persisted locally and needs operator guidance for inspection/reset/triage.

# Impact (UI / logic / data)
- UI: None directly.
- Logic: Operators now have explicit procedures for degraded-mode and reconciliation failures.
- Data: Runbooks reference persisted runtime files under `.run/`.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/features/2026-02-26-p0-hardening-runbooks-durability-and-reconciliation.md

# Date
2026-02-26

## Runbook: Autotask sync failure (poller -> workflow ingestion)
1. Check API logs for `[AutotaskPolling] Workflow sync ingestion failed` and capture `ticket`/timestamp.
2. Confirm poller still processed triage (degraded mode) versus full poll failure.
3. Inspect `/Users/igorbelchior/Documents/Github/Cerebro/.run/p0-workflow-runtime.json`:
   - `audits` for `workflow.sync.*` and `workflow.reconciliation.*`
   - `processedSyncEvents` for duplicate suppression evidence
4. Verify tenant context is available for poller:
   - DB `integration_credentials.tenant_id` for `autotask`, or
   - env fallback `AUTOTASK_POLLER_TENANT_ID` / `P0_SYSTEM_TENANT_ID`
5. If tenant context is missing, restore tenant config and rerun poller cycle (do not add cross-tenant fallback).
6. If sync error persists, use `/workflow/sync/autotask` manually with scoped tenant auth to validate core path separately from poller.

## Runbook: Enrichment partial failure (read-only integrations)
1. Inspect Manager Ops P0 audit feed for `enrichment.read.*` records with `result=failure` and `reason=partial_enrichment_failure`.
2. Confirm envelope `degraded_mode.partial_failures` reports the source and `retryable` flag.
3. Retry only the failing read-only provider path; do not enable writes for IT Glue/Ninja/SentinelOne/Check Point.
4. If failure is auth-related, rotate/re-save credentials in integrations settings and retry.
5. If timeout/rate-limit, preserve core ticket handling and re-run enrichment later (degraded mode is acceptable in P0).

## Runbook: Reconciliation divergence (workflow/local vs Autotask)
1. Query `/workflow/reconciliation-issues` for the tenant/ticket and note `reason` (`autotask_snapshot_mismatch`, etc.).
2. Query `/workflow/audit/:ticketId` and inspect:
   - `workflow.reconciliation.mismatch`
   - `workflow.reconciliation.snapshot_missing`
   - `workflow.reconciliation.match`
3. Compare local inbox projection (`/workflow/inbox`) with remote Autotask snapshot (`/workflow/reconcile/:ticketId` response + audit metadata).
4. If mismatch follows a recent local command, verify command attempt status (`completed`, `retry_pending`, `dlq`, `failed`) and idempotency key.
5. Re-run reconciliation after remote state stabilizes. Do not force-write non-Autotask integrations.

## Runbook: DLQ triage (workflow command execution)
1. Query command status via `/workflow/commands/:commandId` or inspect runtime file `.run/p0-workflow-runtime.json`.
2. Confirm `status='dlq'`, `attempts`, and `last_error`; collect matching `workflow.command.failed` audit entries.
3. Classify cause:
   - transient exhausted (timeouts/rate limits/dependency)
   - terminal validation/policy
4. For transient exhausted:
   - validate Autotask connectivity/credentials
   - inspect retries/backoff timing
   - re-submit a new command with a new idempotency key only after operator validation
5. For policy/validation:
   - preserve audit trail
   - correct payload/permissions upstream
   - do not bypass launch policy (writes only for Autotask)

## Runtime files (P0)
- Workflow runtime: `/Users/igorbelchior/Documents/Github/Cerebro/.run/p0-workflow-runtime.json`
- Trust store runtime: `/Users/igorbelchior/Documents/Github/Cerebro/.run/p0-trust-store.json`

