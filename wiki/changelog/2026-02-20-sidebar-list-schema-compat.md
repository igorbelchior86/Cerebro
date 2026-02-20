# Changelog: Sidebar List Schema Compatibility
# What changed
- Added runtime schema capability check for `tickets_processed.company` in list endpoint.
- Prevented query crash on DBs missing this column.

# Why it changed
- Avoid empty sidebar caused by SQL error during ticket list fetch.

# Impact (UI / logic / data)
- UI: Ticket list remains available across schema versions.
- Logic: Endpoint resilient to partial migration rollout.
- Data: No data model changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/email-ingestion.ts

# Date
- 2026-02-20
