# Sidebar ticket authority and stopwatch handoff
# What changed
- Made the left sidebar the immediate authority for the active ticket in the tri-pane detail workspace.
- On ticket switch in `triage/[id]`, the screen now clears ticket-local derived state from the previous ticket before the next full-flow payload arrives.
- The right context/playbook panel can now hydrate from the selected sidebar ticket immediately, instead of waiting for the remote payload to keep showing the previous ticket.
- The stopwatch now resolves persistence keys from the selected sidebar ticket first, with fallback aliases for the route/session identifier and canonical backend ticket id.
- Stopwatch payload is persisted to all active aliases so leaving one ticket and entering another preserves the previous timer in background and restores the next one immediately.
- Entering a ticket now always auto-starts that ticket's stopwatch.
- Leaving a ticket now consolidates elapsed time and persists that ticket as paused in background.
- The center column now restores the last known ticket workspace state before polling, so previously loaded `Primary` / `Secondary` technicians and analysis timeline do not fall back to `Unassigned` or the initial placeholder.
- That warm ticket workspace state is now also persisted in `sessionStorage`, so a regular browser refresh still restores the previously loaded center-column state for the ticket.
- Hotfix: warm-state restoration now ignores the stale `data.session.ticket_id` from the previously selected ticket, so switching to a new/unseen ticket does not stay visually pinned to the old analyzed ticket.
- Hotfix: stopwatch ticket resolution now also ignores stale `data.session.ticket_id` from the previously selected ticket, so switching to a new/unseen ticket does not inherit the previous ticket's elapsed time.

# Why it changed
- Switching tickets from the left sidebar could leave the center and right columns showing stale context from the previous ticket until polling returned.
- The stopwatch was tied too strongly to the delayed backend `ticket_id`, so switching tickets could lag before the timer context actually changed.
- The original change still missed the explicit product rule that ticket entry should auto-start the timer and ticket exit should auto-pause it.
- The center column was also regressing to a cold-start state on every ticket switch because the UI always cleared local session state before the next poll returned.
- A regular browser refresh was still losing that warm state because the cache only lived in memory.
- The first sessionStorage version introduced a regression: cache lookup still considered the previous ticket's resolved backend id during ticket switch, so unseen tickets could briefly hydrate the old ticket state.
- The same stale identifier was also contaminating stopwatch handoff, causing a brief freeze and then restoration of the previous ticket timer.
- The intended technician workflow is that selecting a ticket in the sidebar changes the whole workspace immediately.

# Impact (UI / logic / data)
- UI:
  - Header, right context panel and chat workspace now pivot immediately to the selected sidebar ticket.
  - Previous ticket context overrides do not leak into the next selected ticket.
- Logic:
  - Ticket selection state is now the first source for active ticket resolution in `triage/[id]`.
  - Stopwatch persistence uses multi-key aliasing to bridge route id, selected sidebar ticket id and canonical backend ticket id.
  - Stopwatch handoff now has explicit entry/exit semantics: auto-start on entry, pause-and-save on exit.
  - Ticket workspace state is cached per ticket and restored on selection, while hard refresh still clears the cache intentionally.
  - Cache restore lookup is now constrained to identifiers of the newly selected ticket only.
  - Stopwatch key resolution is now constrained to identifiers of the newly selected ticket only.
- Data:
  - No database migration.
  - Local browser `localStorage` stopwatch entries can exist under more than one alias for the same ticket to preserve continuity during identifier resolution.
  - Local browser `sessionStorage` now stores the last known center-column workspace snapshot per ticket for refresh-safe restoration.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`

# Date
- 2026-03-06
