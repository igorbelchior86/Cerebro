# Runtime Settings Default Provider From UI
# What changed
- Updated runtime settings application so `LLM_PROVIDER` always reflects UI runtime settings semantics.
- When `settings.llmProvider` is missing/null, process now defaults to `gemini` instead of inheriting stale env provider.

# Why it changed
- Manual and background pipeline runs must respect `Settings > LLM` behavior consistently.
- Prevent provider drift where env-level provider (e.g. groq) overrides UI expectation when provider field is empty.

# Impact (UI / logic / data)
- UI: provider behavior now matches what operator expects from Settings.
- Logic: model provider selection is deterministic (`gemini` fallback) when provider key is absent.
- Data: no schema change.

# Files touched
- apps/api/src/services/runtime-settings.ts

# Date
- 2026-02-20
