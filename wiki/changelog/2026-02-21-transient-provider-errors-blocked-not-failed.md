# Transient Provider Errors: Blocked Instead of Failed
# What changed
- Updated pipeline failure classification to treat transient provider errors as `blocked` instead of `failed`.
- Applied this behavior in both runtime paths:
  - `TriageOrchestrator.runPipeline` catch block
  - `GET /playbook/full-flow` background processing catch block
- Added transient error matcher for provider/infra conditions (`GeminiLimiter`, quota/rate-limit `429`, `RESOURCE_EXHAUSTED`, timeout-like failures).

# Why it changed
- With strict `pipeline ou nada`, no fallback output is allowed.
- Many recent failures were caused by temporary provider quota limits, not deterministic ticket/data issues.
- Marking those as `failed` polluted the failed queue and mixed transient infra with real terminal failures.

# Impact (UI / logic / data)
- UI: transient provider outages now surface as non-terminal blocked items instead of failed cards.
- Logic: failure taxonomy improved (terminal vs retriable) while preserving fail-fast and no-fallback contract.
- Data: session statuses now use `blocked` for retriable provider conditions; no schema change.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/triage-orchestrator.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/playbook.ts

# Date
- 2026-02-21
