# Autotask Ticket Category Draft Defaults
# What changed
- Added backend draft-default resolution in `apps/api/src/clients/autotask.ts` via `getTicketDraftDefaults()`.
- Added `GET /autotask/ticket-draft-defaults` in `apps/api/src/routes/autotask.ts`.
- Expanded `GET /autotask/ticket-field-options` to include `queue`.
- Updated `apps/web/src/lib/p0-ui-client.ts` with `AutotaskTicketDraftDefaults` and `getAutotaskTicketDraftDefaults()`.
- Updated `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx` to consume backend draft defaults, prefill queue/status/priority/SLA and category-driven issue fields, and send `queue_id` on create.

# Why it changed
- The Cerebro draft was inferring defaults from `Tickets/entityInformation/fields`, which is field metadata and picklist catalog, not the effective creation defaults used by the Autotask `New Ticket` form.
- Autotask applies defaults through `ticketCategory` and `TicketCategoryFieldDefaults`, so the draft needed a backend source aligned to the provider’s creation rules.

# Impact (UI / logic / data)
- UI: `triage/home` now loads queue/status/priority/SLA defaults more closely aligned with Autotask and displays the default queue in the draft shell.
- Logic: default selection moved from frontend-only heuristics to a backend resolver that first checks `ticketCategory` defaults and falls back safely when the category-default entity is unavailable.
- Data: ticket creation now includes `queue_id` when a default queue is resolved, improving parity with the provider’s create payload.

# Files touched
- `apps/api/src/clients/autotask.ts`
- `apps/api/src/routes/autotask.ts`
- `apps/web/src/lib/p0-ui-client.ts`
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`
- `wiki/changelog/2026-03-01-autotask-ticket-category-draft-defaults.md`

# Date
- 2026-03-01
