# Triage Sidebar Status Source Of Truth Fix

# What changed
- Removed the status overwrite from the triage ticket page that was mutating the selected sidebar card from `/playbook/full-flow`.
- Kept sidebar card status owned by the workflow inbox adapter only.

# Why it changed
- The selected ticket card could alternate between two different statuses for the same ticket because `/playbook/full-flow` and `/workflow/inbox` were both writing status into the same local sidebar state.
- This created a visible flip such as `New -> Complete -> New` when the two sources were temporarily inconsistent.

# Impact (UI / logic / data)
- UI: the selected sidebar card no longer flips status based on full-flow polling.
- Logic: queue-card status now has a single source of truth in the triage ticket page.
- Data: no persisted data changed.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-05
