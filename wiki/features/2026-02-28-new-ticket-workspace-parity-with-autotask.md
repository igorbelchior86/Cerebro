# New Ticket Workspace Parity With Autotask
# What changed
- Replaced the incorrect standalone intake screen at `/triage/home` with the same tri-pane workspace shell used by an in-progress ticket.
- The `New Ticket` route now opens a draft workspace with empty ticket fields in the center column instead of a separate “start session” page.
- The right column now reuses `PlaybookPanel` again, showing empty draft context rather than a custom placeholder panel.

# Why it changed
- The correct Autotask behavior for `New Ticket` is to keep the same ticket workspace and present empty fields to populate, not a different creation flow.
- The previous implementation diverged from the PSA workflow by introducing a separate intake page and requiring an existing ticket identifier upfront.

# Impact (UI / logic / data)
- UI: `New Ticket` preserves the same tri-pane shell and header structure as the active ticket workspace, but in draft state.
- Logic: `/triage/home` now manages a local draft model (`Account`, `Contact`, `Status`, `Priority`, `Title`, `Description`, `Issue Type`, `Sub-Issue Type`) instead of the old session bootstrap form.
- Data: no backend/API contract changed in this correction; this round only fixes workspace parity and removes the wrong draft bootstrap assumption.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-02-28
