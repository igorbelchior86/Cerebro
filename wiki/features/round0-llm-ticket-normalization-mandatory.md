# Round 0 LLM Ticket Normalization Mandatory
# What changed
- Added mandatory Round 0 in `PrepareContext` to normalize ticket text via LLM before enrichment rounds.
- Normalization now updates working ticket title/description used by the pipeline.
- Added deterministic fallback normalization when LLM output is unavailable/invalid.
- Added `source_findings` record for round 0 with method (`llm` or `deterministic_fallback`) and confidence.
- Added helper JSON extraction for strict LLM-output parsing.
- Added test coverage for deterministic fallback boilerplate stripping.

# Why it changed
- Pipeline must start from high-quality ticket data. Raw email boilerplate/signatures degrade extraction quality in every downstream round.
- User explicitly required ticket-text normalization as essential first stage.

# Impact (UI / logic / data)
- UI: `description_clean` now reflects normalized ticket content from Round 0.
- Logic: company/entity/device correlation receives cleaner text input before round 1.
- Data: Evidence now includes explicit round-0 normalization provenance and confidence.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/prepare-context-device-resolution.test.ts`

# Date
- 2026-02-21
