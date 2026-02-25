# Triage context panel shows assigned tech from Autotask
# What changed
Added a new `Tech` item to the triage right-side `Context` panel in the web UI, using the canonical backend field `data.ticket.assigned_resource_name` from `/playbook/full-flow`.

Also updated the local `SessionData.ticket` TypeScript interface to include `assigned_resource_name` / `assigned_resource_email`.

# Why it changed
The backend now resolves and exposes the Autotask assigned resource (technician) as an authoritative field, but the UI was not displaying it anywhere.

# Impact (UI / logic / data)
- UI: right-side `Context` panel now shows the assigned technician (`Tech`).
- Logic: no backend change; frontend consumption only.
- Data: no schema change.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`

# Date
2026-02-25
