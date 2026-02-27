# Autotask Internal/External Notes Visible in Middle Feed
# What changed
- Updated `/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx` to project `workflow inbox` ticket comments into the central timeline feed.
- Added mapping from note visibility to chat channel:
  - `internal` -> `internal_ai`
  - `public` -> `external_psa_user`
- Added chronological merge/sort for generated pipeline events plus note messages.
- Updated `/apps/web/src/components/ChatMessage.tsx` message contract to support `type: 'note'` and render contextual source labels (`Internal Note` / `PSA/User Note`).

# Why it changed
- Ticket `T20260226.0033` has internal and external Autotask notes that existed in backend read model (`comments`) but were not being rendered in the middle-column feed.
- The timeline builder only rendered pipeline stages and local user messages.

# Impact (UI / logic / data)
- UI: Autotask notes now appear in the central feed, visually tagged by channel and source label.
- Logic: Timeline projection now includes `workflowInbox.comments` and preserves chronological ordering.
- Data: No schema change; consumed existing `WorkflowInboxTicket.comments` payload.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `apps/web/src/components/ChatMessage.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`
- `wiki/features/2026-02-27-autotask-internal-external-notes-visible-in-middle-feed.md`

# Date
- 2026-02-27
