# Phase 1 Gate Checklist - Autotask Two-Way Happy Path

- Gate decision: MET
- Validation session: phase1-autotask-e2e-20260226T231657Z
- Engine baseline (Prompt 2 dependency): workspace HEAD 4abec5d

## Required checks
- [PASS] api typecheck (`pnpm --filter @playbook-brain/api typecheck`) -> `check-api-typecheck.log`
- [PASS] targeted engine tests (`ticket-workflow-core`, `autotask-ticket-workflow-gateway`, `workflow.reconcile-route`) -> `check-targeted-engine-tests.log`
- [PASS] validation execution log captured -> `validation-run.log`

## E2E evidence bundle (live/realistic)
- [PASS] command submit accepted (`202`) -> `s2-command-submit.json`
- [PASS] command process success (`processed=1`, `completed=1`) -> `s2-command-process.json`
- [PASS] sync evidence captured (`applied=true`) -> `s2-sync-evidence.json`
- [PASS] reconcile success (`matched=true`) -> `s2-reconcile-result.json`
- [PASS] audit trail with correlation IDs (`submit/sync/reconcile`) -> `s2-workflow-audit.json`, `s2-correlation-proof.json`

## Idempotency replay
- [PASS] same command twice (same `idempotency_key`) returned same `command_id`
- [PASS] one external mutation (`workflow.command.completed` count for command_id = 1)
- [PASS] replay processing did not create additional completed mutation (`process replay completed=0`)
- Evidence: `s2-command-submit-duplicate.json`, `s2-command-process-replay.json`, `s2-idempotency-replay-proof.json`

## Reconciliation sample
- [PASS] live match sample captured (`matched=true`) -> `s2-reconcile-result.json`
- [PASS] mismatch remediation reference documented -> `reconciliation-sample.md`
