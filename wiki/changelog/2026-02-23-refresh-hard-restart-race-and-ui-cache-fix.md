# Refresh Hard Restart Race And UI Cache Fix
# What changed
- Fixed stale-data behavior after pressing the center-column Refresh button by addressing both backend and frontend cache/race paths.
- Backend (`/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`):
  - added guard checks for ticket-scoped artifact persistence (`ticket_ssot`, `ticket_text_artifact`, `ticket_context_appendix`)
  - superseded sessions (including manual refresh-restarted sessions) can no longer overwrite ticket-global artifacts after a new session is created
- Frontend (`/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`):
  - pauses polling while hard refresh is in progress
  - invalidates in-flight polling responses using request sequence bumps
  - clears local `ticketSnapshotRef` cache for the selected ticket on refresh
  - adds cache-buster query param (`_ts`) to full-flow polling/refresh requests

# Why it changed
- Creating a new triage session on refresh was not enough by itself:
  - older background tasks could still repersist ticket-level artifacts after the refresh
  - the UI could still render cached local snapshots or accept stale in-flight polling responses
- The result was a refresh that looked like a cache hit instead of a true restart.

# Impact (UI / logic / data)
- UI: Refresh now visibly returns to a clean restart state without immediately rehydrating stale data from local snapshots.
- Logic: Ticket-scoped artifacts are protected from writes by superseded sessions after manual restart.
- Data: No schema changes; write guards only.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-02-23
