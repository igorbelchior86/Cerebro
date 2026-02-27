# PSA Note Parity: Tenant-Scoped Lookup + Identifier Fallback
# What changed
- Updated `/apps/api/src/routes/autotask.ts` (`GET /autotask/ticket/:id/notes`):
  - switched from env-only client to tenant-scoped client (`getTenantScopedClient()`);
  - added support for non-numeric ticket references (ticket number, e.g. `T20260226.0033`) by resolving via `getTicketByTicketNumber()`;
  - response now includes `ticket_lookup` metadata (`requested_ref`, `resolved_ticket_id`).
- Updated `/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx` notes lookup strategy:
  - fallback chain for notes lookup reference:
    1) `ticket.autotask_ticket_id_numeric`
    2) `ssot.autotask_authoritative.ticket_id_numeric`
    3) `workflow inbox external_id`
    4) `ticket.id`
    5) resolved ticket/session ID
  - request now uses encoded generic ref (`/autotask/ticket/:ref/notes`) instead of only numeric id.
  - preserved existing merge/dedup/order behavior for timeline notes.

# Why it changed
- A specific PSA communication note still did not appear in Cerebro after prior note rendering fixes.
- Root cause was identifier/credential resolution mismatch, not only rendering: the notes endpoint could miss tenant context and fail for non-numeric ticket refs.

# Impact (UI / logic / data)
- UI: higher parity for PSA notes visibility in the middle feed.
- Logic: robust Autotask note retrieval by tenant and ticket identity fallback.
- Data: no schema migration required; read-path enhancement only.

# Files touched
- `apps/api/src/routes/autotask.ts`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`
- `wiki/features/2026-02-27-psa-note-parity-tenant-scoped-lookup-fallback.md`

# Date
- 2026-02-27
