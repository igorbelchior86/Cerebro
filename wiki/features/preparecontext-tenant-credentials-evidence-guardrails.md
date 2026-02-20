# PrepareContext Tenant Credentials + Evidence Guardrails
# What changed
- Updated `PrepareContextService` to resolve Autotask/NinjaOne/IT Glue credentials from `integration_credentials` using the session tenant context, with deterministic fallback to latest workspace credentials and then env fallback.
- Updated session creation flows to persist `tenant_id` (`triage`, `prepare-context`, `playbook/full-flow`, and orchestrator auto-created sessions), enabling tenant-scoped credential resolution in runtime pipeline stages.
- Added shared evidence guardrail logic in `evidence-guardrails.ts`.
- Added diagnosis guardrails:
  - Prompt constraints to treat related cases as weak priors.
  - Prompt constraints to treat integration auth failures as missing data (not root cause) unless explicitly ticket-related.
  - Runtime fallback when diagnosis introduces unsupported high-risk narrative.
- Added playbook guardrails:
  - Prompt constraints to avoid remediation drift from ticket issue to integration-credential remediation.
  - Runtime fallback to deterministic playbook when generated markdown violates evidence grounding rules.
- Added unit tests for guardrail scenarios (`evidence-guardrails.test.ts`).

# Why it changed
- The pipeline was reading credentials from process env while the UI health check used DB-stored workspace credentials, causing "Connected" in UI with runtime `401/invalid_client` in PrepareContext.
- Diagnosis and playbook generation were drifting into unsupported high-severity narratives and remediation plans that were not anchored in direct ticket evidence.

# Impact (UI / logic / data)
- UI: No direct visual change; behavior now aligns with connection status expectations.
- Logic:
  - Runtime integrations in PrepareContext now follow workspace/tenant credentials.
  - LLM outputs are constrained by direct-evidence guardrails, reducing hallucinated compromise narratives and integration-root-cause drift.
- Data:
  - `triage_sessions.tenant_id` is now populated in key creation paths, enabling tenant-scoped credential lookup consistency.
  - No schema change required in this patch.

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
