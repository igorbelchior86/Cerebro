# Gemma 3 27B AI Studio Provider Alignment
# What changed
- Changed `GeminiProvider` default model from `gemini-2.5-flash` to `gemma-3-27b-it`.

# Why it changed
- Ensure app defaults match deployed model path (AI Studio / Gemini API) and avoid provider mismatch.

# Impact (UI / logic / data)
- UI: unchanged.
- Logic: correct provider/model default.
- Data: unchanged.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/llm-adapter.ts
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/features/gemma3-aistudio-provider-alignment.md

# Date
- 2026-02-21
