# PrepareContext Real Source Crossing
# What changed
- Added `company` extraction in email intake parser and persisted it in `tickets_processed.company`.
- Added migration `007_tickets_processed_company.sql`.
- Reworked `PrepareContextService` to generate structured `source_findings` based on actual queries/results.
- Implemented organization resolution by company for NinjaOne and IT Glue.
- Implemented requester correlation against NinjaOne device names and IT Glue contacts/configurations.
- Removed fake external status payload; external source now reports as not queried when adapter is absent.
- Updated center timeline item 2 to render `source_findings` first (real data), with fallback for legacy done tickets.

# Why it changed
- The timeline needed to display only real crossed data, not generic placeholders.
- Users need to trust that each listed source reflects an actual query and match outcome.

# Impact (UI / logic / data)
- UI: PrepareContext steps now reflect real source outcomes (`queried/matched/summary`).
- Logic: Pipeline now performs deterministic cross-source correlation using company/requester anchors.
- Data: New optional payload field `source_findings`; new DB column `tickets_processed.company`.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/email/email-parser.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/email/pg-store.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/email-ingestion.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/db/migrations/007_tickets_processed_company.sql
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/packages/types/src/index.ts

# Date
- 2026-02-20
