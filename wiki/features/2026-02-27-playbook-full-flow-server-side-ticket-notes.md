# Playbook Full-Flow Server-Side Ticket Notes
# What changed
- Updated `/apps/api/src/routes/playbook.ts` so `/playbook/full-flow` now fetches Autotask ticket notes server-side and returns them as `data.ticket_notes`.
- Updated `/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx` to consume `flowData.ticket_notes` from the main payload instead of relying on a separate best-effort browser request.
- Existing frontend note filtering/composition logic remains in place (workflow-rule exclusion, content composition, chronological merge).

# Why it changed
- The missing `2:22 PM` note was still absent from Cerebro, which proved the browser-side auxiliary fetch was not a reliable source of truth.
- Ticket communications are core data for the triage screen and must be delivered in the main backend payload.

# Impact (UI / logic / data)
- UI: Higher reliability for PSA note visibility in the central feed.
- Logic: Note retrieval now happens in the backend read model path (`full-flow`), reducing silent client-side failure modes.
- Data: No schema change; response payload extended with `data.ticket_notes`.

# Files touched
- `apps/api/src/routes/playbook.ts`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`
- `wiki/features/2026-02-27-playbook-full-flow-server-side-ticket-notes.md`

# Date
- 2026-02-27
