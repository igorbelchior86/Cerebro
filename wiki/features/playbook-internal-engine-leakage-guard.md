# Playbook Internal-Engine Leakage Guard
# What changed
- Added deterministic contamination guard in `PlaybookWriterService` for internal-engine/meta leakage terms.
- Added explicit forbidden-term prompt instruction to prevent generation of internal steps such as:
  - `LLM`
  - `JSON response`
  - `prompt`
  - `model output`
- Added post-generation safeguards:
  - contamination detection (`hasInternalLeakage`)
  - sanitization of contaminated lines (`sanitizePlaybook`)
  - deterministic fallback when contamination is detected before persistence.
- Added regression tests for contamination detection/sanitization.

# Why it changed
- Generated playbook checklist included internal pipeline instruction (`Check LLM JSON Response`), which is not an operational support action.
- This represented leakage of engine/meta instructions into customer-facing runbook steps.

# Impact (UI / logic / data)
- UI:
  - Checklist no longer surfaces internal LLM/meta instructions.
- Logic:
  - Playbook output now passes a deterministic contamination check before persistence.
  - If contamination is detected, pipeline falls back to deterministic safe playbook.
- Data:
  - No schema changes.
  - Affected playbooks are regenerated with sanitized/guarded content.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/playbook-writer.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/playbook-writer-contamination.test.ts

# Date
- 2026-02-20
