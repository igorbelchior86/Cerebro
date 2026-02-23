# SSOT Cache + Recursive Ingestion Flow
# What changed
- Added a ticket SSOT cache table and persistence from `PrepareContext` using enriched fields.
- Updated ingestion flow to iterate: intake (Autotask/email) -> IT Glue -> Ninja -> history -> IT Glue -> Ninja.
- Full-flow API responses now prefer SSOT fields for canonical ticket data.

# Why it changed
- Provide a deterministic, cached source of truth for all ticket-level fields.
- Ensure recursive enrichment after history can fill gaps and refine device/org context.

# Impact (UI / logic / data)
- UI: Canonical ticket fields in full-flow responses are now sourced from SSOT when available.
- Logic: PrepareContext performs a second IT Glue and Ninja pass after history correlation.
- Data: New `ticket_ssot` table with JSON payload and indexes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/playbook.ts
- /Users/igorbelchior/Documents/Github/Cerebro/init.sql
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/db/migrations/009_ticket_ssot.sql
- /Users/igorbelchior/Documents/Github/Cerebro/packages/types/dist/index.d.ts
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/features/ssot-cache-recursive-ingestion-flow.md

# Date
- 2026-02-23
