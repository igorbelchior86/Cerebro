# Sidebar Ticket Time Race Fix (7:00 AM vs 6:32 PM)
# What changed
- Implemented deterministic timestamp merge in triage sidebar state so `created_at` no longer flips between asynchronous polling writers.
- Added `pickEarliestIso` strategy in `/triage/[id]/page.tsx` and used it when merging incoming sidebar tickets and when patching the active selected ticket.
- Removed fallback in `workflow-sidebar-adapter` that previously mapped missing `created_at` to operational timestamps (`updated_at`, `last_event_occurred_at`, `last_sync_at`).
- Adjusted full-flow canonical ticket assembly to prioritize `dbTicket.created_at` before `ssot.created_at`.

# Why it changed
- The sidebar card time was alternating between a true ticket-created time and a processing/event timestamp due to concurrent polling updates (inbox polling and full-flow polling) writing the same UI field with different semantics.

# Impact (UI / logic / data)
- UI: card time is stable for the same ticket and should no longer oscillate between values like `7:00 AM` and `6:32 PM`.
- Logic: `created_at` now follows a deterministic canonical rule (earliest valid ISO among trusted sources), and event timestamps cannot overwrite ticket-created time in sidebar mapping.
- Data: no schema or persistence change.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `apps/web/src/lib/workflow-sidebar-adapter.ts`
- `apps/api/src/services/application/route-handlers/playbook-route-handlers.ts`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-04
