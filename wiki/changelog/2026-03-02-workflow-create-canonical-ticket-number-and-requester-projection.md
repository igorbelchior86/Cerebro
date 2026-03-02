# Workflow Create Canonical Ticket Number and Requester Projection
# What changed
- Updated `apps/api/src/services/orchestration/ticket-workflow-core.ts`:
  - Prioritized `external_ticket_number` over `external_ticket_id` for ticket identity in:
    - local projection (`applyLocalProjectionFromCommandResult`)
    - realtime publish payload
    - audit target selection
  - Added projection/persistence of `ticket_number` and `requester` in `InboxTicketState` and ticket domain snapshots.
- Updated `apps/api/src/services/orchestration/autotask-ticket-workflow-gateway.ts`:
  - Added robust ticket number extraction (`ticketNumber`, `ticketnumber`, `ticket_number`).
  - Added requester extraction fallback (`contactName`, `requesterName`, `requester`).
  - Added best-effort contact enrichment in `enrichTicketSnapshot` using `getContact(contactID)` when requester name is missing.
  - Included `contact_id` in mapped snapshot.
- Updated `apps/api/src/__tests__/services/ticket-workflow-core.test.ts` to keep canonical ticket number across post-create commands.

# Why it changed
- After create, UI switched from canonical Autotask ticket code (`T...`) to numeric internal ID and requester/contact regressed to `Unknown user`.
- Root cause was post-command local projection choosing numeric external id and missing requester/contact propagation.

# Impact (UI / logic / data)
- UI: Ticket identity remains canonical (`T...`) after create; requester/contact is preserved instead of regressing to unknown.
- Logic: Workflow projection and realtime events now align with external-system canonical identifiers.
- Data: No schema migration; in-memory/runtime inbox state now carries richer projected fields (`ticket_number`, `requester`).

# Files touched
- apps/api/src/services/orchestration/ticket-workflow-core.ts
- apps/api/src/services/orchestration/autotask-ticket-workflow-gateway.ts
- apps/api/src/__tests__/services/ticket-workflow-core.test.ts

# Date
- 2026-03-02
