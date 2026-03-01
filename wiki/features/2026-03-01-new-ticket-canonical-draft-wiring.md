# New Ticket Canonical Draft Wiring
# What changed
- Replaced the custom `triage/home` intake form with the same tri-pane shell used by the ticket workspace.
- Wired the draft `title` into the header, `Primary` and `Secondary` tech assignment into the existing pills, and `Org`, `Contact`, and `Additional contacts` into the existing right-side context panel.
- Reused `ChatInput` as the local composer for the ticket body and rendered the composed body in the center feed as a draft preview.
- Kept the new-ticket flow under the `Triage` route/state until queue-specific UI exists.

# Why it changed
- The previous implementation diverged from the requested Autotask-like behavior by introducing a parallel form layout instead of reusing the canonical ticket workspace.
- The correct behavior is to keep the same operational layout and only swap the data source to a blank local draft.

# Impact (UI / logic / data)
- UI: `New Ticket` now stays visually aligned with the existing ticket screen instead of switching to a separate form.
- Logic: Draft assignment fields now use local Autotask search wiring for companies, contacts, and resources without creating a live ticket yet.
- Data: No backend writes were added; the draft remains frontend-only and queue placement stays implicitly in `Triage`.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-03-01
