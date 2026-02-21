# 2026-02-21 Round0 LLM Ticket Normalization Mandatory
# What changed
- Implemented mandatory round-0 ticket normalization using LLM at pipeline intake.
- Added deterministic fallback normalization path.
- Persisted normalization provenance in `source_findings` with confidence.
- Ensured normalized text feeds `description_clean` and downstream enrichment.

# Why it changed
- Ticket data is the root dataset for iterative enrichment; normalization must happen before cross-system correlation.

# Impact (UI / logic / data)
- UI: cleaner `description_clean`.
- Logic: improved extraction signal quality from first round.
- Data: explicit traceability for normalization method and confidence.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/prepare-context-device-resolution.test.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/wiki/features/round0-llm-ticket-normalization-mandatory.md`

# Date
- 2026-02-21
