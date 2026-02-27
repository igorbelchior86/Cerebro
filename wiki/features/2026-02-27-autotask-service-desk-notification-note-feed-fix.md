# Autotask Service Desk Notification Note Feed Fix
# What changed
- Updated `/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx` to fetch notes directly from Autotask endpoint (`/autotask/ticket/:id/notes`) when `autotask_ticket_id_numeric` is available.
- Merged these notes into the central timeline as `type: note` messages.
- Added visibility mapping for Autotask notes using `publish`:
  - `publish = 1` -> `external_psa_user`
  - otherwise -> `internal_ai`
- Added deduplication between local workflow comments and direct Autotask notes to avoid duplicate bubbles.
- Extended frontend ticket type to include `autotask_ticket_id_numeric` for deterministic note fetch.

# Why it changed
- A specific note visible in Autotask (Service Desk Notification) was missing in Cerebro.
- Root cause: workflow inbox comments are not a complete mirror of all Autotask notes; some externally-generated notes were not present in the local comments read model.

# Impact (UI / logic / data)
- UI: Missing Autotask notes now appear in the middle feed.
- Logic: Timeline projection now combines two note sources (workflow comments + direct Autotask notes) with dedupe.
- Data: No schema migration; consumed existing fields and endpoint.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`
- `wiki/features/2026-02-27-autotask-service-desk-notification-note-feed-fix.md`

# Date
- 2026-02-27
