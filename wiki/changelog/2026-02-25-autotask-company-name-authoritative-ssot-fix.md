# Autotask company name authoritative SSOT fix
# What changed
Added an Autotask company lookup during `PrepareContext` intake using `companyID` from the ticket (`GET /companies/{id}`), and used the resolved company name to populate `ticket.company` before SSOT assembly.

Extended `ticket_ssot.payload.autotask_authoritative` with `company_name`, and updated API/UI payload selection to prefer `autotask_authoritative.company_name` when present.

# Why it changed
The previous SSOT promotion stored `company_id` (authoritative ID) but not the corresponding company display name. The UI renders organization/company labels using display text, so tickets still showed `unknown org` even though the Autotask ID was correctly persisted.

# Impact (UI / logic / data)
- UI: Header/context/sidebar organization labels can render the Autotask-authoritative company name instead of `unknown`.
- Logic: `PrepareContext` performs one additional best-effort Autotask lookup (`Companies`) when ticket company name is missing/unknown.
- Data: `ticket_ssot.payload.autotask_authoritative.company_name` is now persisted for new/reprocessed tickets.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/clients/autotask.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/playbook.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/email-ingestion.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
2026-02-25
