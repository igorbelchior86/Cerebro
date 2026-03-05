# Remove Ticket Intake Runtime and Fallback
# What changed
- Removed ticket-intake fallback from `PrepareContextService` intake. Tickets are now resolved from Autotask only.
- `T...` ticket IDs are looked up exclusively via Autotask `ticketNumber` query; no fallback to `tickets_processed` or `tickets_raw`.
- Disabled ticket-intake runtime entrypoints in the API server:
  - no `/ticket-intake` route mounted
  - no `TicketIntakePollingService` startup
- Hardened `AutotaskClient` ID endpoints to parse `item` responses (in addition to `records/items`) for better API compatibility.

# Why it changed
- The product decision is to use only sources configurable in the UI (Autotask, NinjaOne, IT Glue) and eliminate email as a data source/fallback path.
- Keeping email fallback active undermined the single-pipeline/source-of-truth requirement.

# Impact (UI / logic / data)
- UI: No visual changes. Integrations continue to be managed via the UI.
- Logic: Pipeline intake now depends exclusively on Autotask for ticket retrieval; email fallback is removed.
- Data: Existing ticket-intake tables remain in the database but are no longer used by the active API runtime path.

# Files touched
- `apps/api/src/services/prepare-context.ts`
- `apps/api/src/index.ts`
- `apps/api/src/clients/autotask.ts`
- `apps/api/src/__tests__/clients/autotask.test.ts`
- `tasks/todo.md`
- `tasks/lessons.md`
- `wiki/changelog/2026-02-25-remove-ticket-intake-runtime-and-fallback.md`

# Date
- 2026-02-25
