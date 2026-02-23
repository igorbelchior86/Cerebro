# Step 2C Ninja Raw Snapshot and Enrichment Cache
# What changed
Implemented the NinjaOne equivalent of Step 2B in Prepare Context: broad org-scoped Ninja capture (organization, devices, alerts, selected device telemetry) persisted as `ninja_org_snapshot`, plus a heuristic LLM extraction cache persisted as `ninja_org_enriched`. Added refresh cleanup support for the new Ninja caches/snapshots and database migrations for both tables.
# Why it changed
Step 2C requires the same capture/extract pattern used for IT Glue to be applied to NinjaOne before cross-source fusion (Step 2D). This preserves raw data, allows heuristic extraction/caching, and prepares a deterministic base for later SSOT fusion.
# Impact (UI / logic / data)
UI: No direct UI change.
Logic: Prepare Context Round 3 now persists a Ninja raw snapshot and computes a Ninja heuristic enrichment cache (best-effort, cached by source hash).
Data: New tables `ninja_org_snapshot` and `ninja_org_enriched`; `refresh=1` now clears Ninja snapshot/enriched records when org IDs can be inferred from the current evidence pack.
# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/playbook.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/db/migrations/012_ninja_org_snapshot_enriched.sql
# Date
2026-02-23
