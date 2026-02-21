# Gemma 3 27B Preventive Quota Guard
# What changed
- Hardened Groq/Gemma adapter with preventive budget checks (RPM/RPD/TPM) before sending requests.
- Added better reset-header duration parsing for wait scheduling.
- Default Groq model set to `gemma-3-27b-it` (override via `GROQ_MODEL`).

# Why it changed
- Prevent request overflow on free-tier usage and reduce avoidable 429-driven failures.

# Impact (UI / logic / data)
- UI: improved pipeline stability under quota pressure.
- Logic: stricter preflight throttling.
- Data: unchanged.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/llm-adapter.ts
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/features/gemma3-27b-preventive-quota-guard.md

# Date
- 2026-02-21
