# 2026-02-20 Runtime Settings Default Provider From UI
# What changed
- `applyWorkspaceRuntimeSettings` now sets `LLM_PROVIDER` to:
  - `settings.llmProvider` when provided
  - `gemini` when `settings.llmProvider` is null/missing

# Why it changed
- Ensures runtime provider selection respects UI settings semantics and avoids env drift.

# Impact (UI / logic / data)
- Consistent provider behavior across reprocess and pipeline runs.

# Files touched
- apps/api/src/services/runtime-settings.ts

# Date
- 2026-02-20
