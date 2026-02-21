# Gemma 3 27B Preventive Quota Guard
# What changed
- Added preventive quota guard in Groq adapter path used by Gemma 3 27B.
- Implemented preflight gating before request dispatch using minute/day request windows and minute token budget.
- Added robust parsing for Groq reset headers (`x-ratelimit-reset-*`) including mixed formats (e.g. `2m59.56s`).
- Made Groq model explicit/configurable with default `gemma-3-27b-it` via `GROQ_MODEL`.

# Why it changed
- Goal is to avoid quota overflow, not only react after 429/rate-limit errors.
- User explicitly runs on Gemma 3 27B and requested hard prevention behavior.

# Impact (UI / logic / data)
- UI: fewer transient pipeline failures caused by LLM rate-limit bursts.
- Logic: requests are blocked preflight when quota window cannot accept them.
- Data: no schema change.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/llm-adapter.ts

# Date
- 2026-02-21
