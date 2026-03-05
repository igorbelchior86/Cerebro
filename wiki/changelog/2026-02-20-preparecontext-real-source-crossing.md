# Changelog: PrepareContext Real Source Crossing
# What changed
- Added email intake extraction/persistence for ticket company.
- Added structured per-source provenance (`source_findings`) in Evidence Pack.
- Updated PrepareContext timeline rendering to use provenance data when available.
- Preserved fallback behavior for legacy done tickets.

# Why it changed
- Replace generic source text with auditable real crossed data.

# Impact (UI / logic / data)
- UI: Timeline source rundown is evidence-driven.
- Logic: Cross-source matching now uses company + requester context.
- Data: `tickets_processed.company` column and optional `source_findings` payload field.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/email/email-parser.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/email/pg-store.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/ticket-intake.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/db/migrations/007_tickets_processed_company.sql

# Date
- 2026-02-20
