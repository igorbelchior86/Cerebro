# Changelog: PrepareContext Tenant Credentials + Evidence Guardrails
# What changed
- Rewired PrepareContext integrations to read credentials from `integration_credentials` (tenant-aware) instead of relying only on process env.
- Persisted `tenant_id` in session creation paths so tenant-scoped credentials are resolvable during pipeline execution.
- Added evidence-anchoring guardrails in diagnosis and playbook generation (prompt constraints + runtime fallback checks).
- Added unit tests for guardrail heuristics.

# Why it changed
- Fix split-brain behavior where UI showed integrations as connected while runtime pipeline calls failed with auth errors.
- Prevent non-sensical playbooks caused by unsupported high-risk inference or integration-remediation drift.

# Impact (UI / logic / data)
- UI: Connection status now better reflects runtime behavior.
- Logic: Pipeline pulls tenant/workspace credentials consistently and downgrades unsupported model outputs to deterministic safe fallbacks.
- Data: Session records now include tenant context in key creation paths; no migration needed.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/evidence-guardrails.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/diagnose.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/playbook-writer.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/triage-orchestrator.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/triage.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/prepare-context.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/playbook.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/evidence-guardrails.test.ts

# Date
- 2026-02-20
