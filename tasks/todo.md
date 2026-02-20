# Task: Respect UI LLM provider setting during reprocess
**Status**: completed
**Started**: 2026-02-20

## Plan
- [x] Step 1: Confirm current provider provenance in runtime and DB.
- [x] Step 2: Fix runtime setting behavior to avoid env-provider drift when UI provider is empty.
- [x] Step 3: Reprocess target tickets without forcing provider.
- [x] Step 4: Verify persisted models for diagnose/playbook.
- [x] Step 5: Update wiki and lessons.

## Open Questions
- None.

## Progress Notes
- Found tenant `settings.llmProvider = null`, which previously allowed env-level provider to dominate.
- Changed runtime settings logic to default provider to `gemini` when provider missing.
- Reprocessed 3 tickets with runtime settings bootstrap; all persisted as `diagnose_model=gemini` and `playbook_model=gemini`.

## Review
- What worked:
- Provider provenance verification via persisted `llm_outputs.model` eliminated ambiguity immediately.
- What was tricky:
- UI settings had partial data (`llmModel` present, `llmProvider` absent), which previously caused implicit env fallback.
- Time taken:
- ~10 minutes
