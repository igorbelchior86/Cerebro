# IT Glue Org Snapshot + LLM Extraction
# What changed
- Added IT Glue org snapshot + enriched cache tables.
- Persisted raw org snapshot and LLM-extracted fields with evidence refs and confidence.
- PrepareContext now prefers enriched IT Glue values for infra/network fields.

# Why it changed
- Deterministic extraction missed most IT Glue-derived fields.
- LLM extraction over full org snapshot improves coverage and consistency.
- Cache avoids repeated heavy extraction on every ticket.

# Impact (UI / logic / data)
- UI: No direct UI changes; SSOT fields should improve data completeness.
- Logic: PrepareContext uses cached enriched IT Glue values when present.
- Data: New tables `itglue_org_snapshot` and `itglue_org_enriched`.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts
- /Users/igorbelchior/Documents/Github/Cerebro/init.sql
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/db/migrations/010_itglue_org_snapshot.sql
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/features/itglue-org-snapshot-llm-extraction.md

# Date
- 2026-02-23
