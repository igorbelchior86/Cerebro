# Pipeline Fail-fast Without Fallback
# What changed
- Removed residual deterministic fallback builders from `DiagnoseService` and `PlaybookWriterService`.
- Kept diagnose/playbook generation strictly provider-backed; on model error/guardrail contamination/parse failure, pipeline now fails with explicit error and session status `failed`.
- Renamed guardrail APIs from downgrade semantics to blocking semantics:
  - `shouldDowngradeDiagnosisToFallback` -> `shouldBlockDiagnosisOutput`
  - `shouldDowngradePlaybookToFallback` -> `shouldBlockPlaybookOutput`
- Updated tests to assert fail-fast behavior and guardrail blocking terminology.

# Why it changed
- Product rule is explicit: `pipeline ou nada`.
- Any fallback-generated diagnosis/playbook violates deterministic provenance and causes UI oscillation/confusion (raw vs normalized/source-of-truth drift).

# Impact (UI / logic / data)
- UI: cards no longer show synthetic fallback playbooks/diagnoses; failures surface as pipeline failure states.
- Logic: diagnose/playbook stages are fail-fast only; no synthetic fallback content generation remains in runtime flow.
- Data: `llm_outputs.model` no longer receives new `*fallback*` values from current pipeline code.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/diagnose.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/playbook-writer.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/evidence-guardrails.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/evidence-guardrails.test.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/diagnose-fail-fast.test.ts

# Date
- 2026-02-21
