# Autotask Create Ticket Identifier Fallback
# What changed
- Updated `packages/integrations/src/autotask/client.ts` `createTicket` response parsing.
- Added fallback path for create responses that do not include `item/items/records`:
  - Read `itemId` or `id` from response body.
  - If present, fetch full ticket via `getTicket(createdId)` and return hydrated ticket object.
- Added unit test in `apps/api/src/__tests__/clients/autotask.test.ts` validating identifier-only response handling.

# Why it changed
- UI error showed: `Autotask createTicket returned no ticket` after assignment payload was accepted.
- Provider can return create confirmation with identifier-only payload instead of full entity object.

# Impact (UI / logic / data)
- UI: New Ticket flow no longer fails when provider returns create confirmation without embedded ticket object.
- Logic: `createTicket` remains strongly typed returning full ticket, now resilient to identifier-only create payloads.
- Data: No schema or API version changes.

# Files touched
- packages/integrations/src/autotask/client.ts
- apps/api/src/__tests__/clients/autotask.test.ts

# Date
- 2026-03-02
