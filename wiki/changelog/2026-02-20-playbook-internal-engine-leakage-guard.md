# Changelog: Playbook Internal-Engine Leakage Guard
# What changed
- Implemented leakage guard in playbook generation to block internal/meta instructions.
- Added explicit prompt prohibition for engine terms (`LLM`, `JSON response`, `prompt`, `model output`).
- Added fallback behavior when contamination is detected.
- Reprocessed `T20260220.0017` and confirmed no internal-engine phrases in generated playbook.

# Why it changed
- A generated playbook included non-operational internal instruction (`Check LLM JSON Response`) in checklist.

# Impact (UI / logic / data)
- UI: cleaner, operational checklist without internal engine/debug terms.
- Logic: deterministic pre-persist content validation + sanitization/fallback.
- Data: no schema changes; regenerated playbook content.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/playbook-writer.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/playbook-writer-contamination.test.ts

# Date
- 2026-02-20
