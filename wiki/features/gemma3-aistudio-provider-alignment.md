# Gemma 3 27B AI Studio Provider Alignment
# What changed
- Updated Gemini provider default model to `gemma-3-27b-it` in the AI Studio path.
- Kept model override via `GEMINI_MODEL` env var.

# Why it changed
- Runtime in this environment uses Gemma 3 27B through AI Studio (Gemini API), not Groq.
- Required explicit provider/model alignment to match user setup.

# Impact (UI / logic / data)
- UI: no direct change.
- Logic: LLM default routing now aligns with intended model/provider.
- Data: no schema changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/llm-adapter.ts

# Date
- 2026-02-21
