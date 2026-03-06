# Sidebar ticket authority and stopwatch handoff
# What changed
- Made the left sidebar the immediate authority for the active ticket in the tri-pane detail workspace.
- On ticket switch in `triage/[id]`, the screen now clears ticket-local derived state from the previous ticket before the next full-flow payload arrives.
- The right context/playbook panel can now hydrate from the selected sidebar ticket immediately, instead of waiting for the remote payload to keep showing the previous ticket.
- The stopwatch now resolves persistence keys from the selected sidebar ticket first, with fallback aliases for the route/session identifier and canonical backend ticket id.
- Stopwatch payload is persisted to all active aliases so leaving one ticket and entering another preserves the previous timer in background and restores the next one immediately.
- Entering a ticket now always auto-starts that ticket's stopwatch.
- Leaving a ticket now consolidates elapsed time and persists that ticket as paused in background.

# Why it changed
- Switching tickets from the left sidebar could leave the center and right columns showing stale context from the previous ticket until polling returned.
- The stopwatch was tied too strongly to the delayed backend `ticket_id`, so switching tickets could lag before the timer context actually changed.
- The original change still missed the explicit product rule that ticket entry should auto-start the timer and ticket exit should auto-pause it.
- The intended technician workflow is that selecting a ticket in the sidebar changes the whole workspace immediately.

# Impact (UI / logic / data)
- UI:
  - Header, right context panel and chat workspace now pivot immediately to the selected sidebar ticket.
  - Previous ticket context overrides do not leak into the next selected ticket.
- Logic:
  - Ticket selection state is now the first source for active ticket resolution in `triage/[id]`.
  - Stopwatch persistence uses multi-key aliasing to bridge route id, selected sidebar ticket id and canonical backend ticket id.
  - Stopwatch handoff now has explicit entry/exit semantics: auto-start on entry, pause-and-save on exit.
- Data:
  - No database migration.
  - Local browser `localStorage` stopwatch entries can exist under more than one alias for the same ticket to preserve continuity during identifier resolution.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`

# Date
- 2026-03-06
