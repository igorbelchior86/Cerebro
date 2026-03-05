# Autotask contact and resource authoritative promotion
# What changed
Extended Autotask intake enrichment in `PrepareContext` to resolve and promote `Contacts` and `Resources` derived from `contactID` and `assignedResourceID`.

New fields persisted in `ticket_ssot.payload.autotask_authoritative`:
- `contact_name`
- `contact_email`
- `assigned_resource_name`
- `assigned_resource_email`

The SSOT anti-regression layer now seeds `requester_name`/`requester_email` from authoritative contact values, and API/list payloads prioritize these values for requester display.

# Why it changed
The previous implementation promoted Autotask IDs but left requester display fields dependent on normalization/inference. This caused UI inconsistency despite the Autotask ticket already having a canonical `contactID` and `assignedResourceID`.

# Impact (UI / logic / data)
- UI: requester labels in sidebar/detail can use Autotask-authoritative contact values.
- Logic: `PrepareContext` performs best-effort Autotask lookups for `Contacts` and `Resources` during intake.
- Data: richer `autotask_authoritative` payload in `ticket_ssot` and expanded canonical ticket payload in `/playbook/full-flow`.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/clients/autotask.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/playbook.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/ticket-intake.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/wiki/changelog/2026-02-25-autotask-contact-resource-authoritative-promotion.md`

# Date
2026-02-25
