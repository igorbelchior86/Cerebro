# IT Glue Firewall Credential Extraction
# What changed
- Added summary-based IT Glue extraction input to ensure password titles are visible to the LLM.
- Versioned IT Glue extractor hash to force refresh when extraction logic changes.
- Applied missing DB migrations locally for snapshot/enriched tables.

# Why it changed
- Raw snapshot truncation hid firewall credentials from the LLM.
- Cache was not regenerating after extractor changes.
- Missing tables prevented persistence and downstream usage.

# Impact (UI / logic / data)
- UI: Firewall field should now populate when credentials exist.
- Logic: IT Glue extraction uses condensed names, reducing prompt loss.
- Data: Snapshot/enriched caches are now present in DB.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts
- /Users/igorbelchior/Documents/Github/Cerebro/init.sql
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/db/migrations/008_triage_retry_fields.sql
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/db/migrations/009_ticket_ssot.sql
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/db/migrations/010_itglue_org_snapshot.sql
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/features/itglue-firewall-credential-extraction.md

# Date
- 2026-02-23
