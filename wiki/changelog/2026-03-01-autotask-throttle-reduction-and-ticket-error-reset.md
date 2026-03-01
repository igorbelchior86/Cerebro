# Autotask Throttle Reduction And Ticket Error Reset
# What changed
- The hidden inline `New Ticket` workspace no longer preloads Autotask draft metadata while it is inactive inside the triage shell.
- The `New Ticket` draft bootstrap now fetches the aggregated field catalog and draft defaults only, instead of fan-out calling the aggregate endpoint plus six per-field endpoints at the same time.
- The backend `/autotask/ticket-field-options` aggregate route now loads each picklist sequentially instead of issuing six parallel provider calls.
- The ticket detail page now clears the `Connection error` banner immediately after a later `/playbook/full-flow` success.

# Why it changed
- Runtime logs showed the proxy fix was active, but Autotask was still returning `429` due to its thread threshold of 3.
- The biggest source of pressure was the mounted-but-hidden draft workspace and the aggregate picklist route doing excessive concurrent provider calls.
- Separately, `/playbook/full-flow` was returning `200`, but the UI kept showing a stale error because the success path did not reset the previous error state.

# Impact (UI / logic / data)
- UI: Fewer selector failures for `Org`, `Contact`, `Additional contacts`, `Primary`, `Secondary`, `Priority`, `Issue Type`, `Sub-Issue Type`, and `SLA` under normal usage; transient ticket transport errors no longer stick after recovery.
- Logic: Draft metadata bootstrap is now gated by active draft mode, and picklist aggregation is serialized to stay under provider concurrency limits.
- Data: No schema changes and no payload contract changes.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `apps/web/src/components/new-ticket-workspace-context.tsx`
- `apps/api/src/routes/autotask.ts`
- `tasks/todo.md`

# Date
- 2026-03-01
