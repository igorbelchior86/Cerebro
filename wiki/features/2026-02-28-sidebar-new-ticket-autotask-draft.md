# Sidebar New Ticket Autotask Draft
# What changed
- The left sidebar stats block now keeps only the `Active` metric.
- The former `Done today` and `Avg time` tiles were replaced by a single `New Ticket` action button.
- The `New Ticket` action now routes the technician workflow to a tri-pane draft state at `/triage/home`.
- The `/triage/home` route was repurposed into an Autotask-first intake surface that creates sessions via the existing `POST /triage/sessions` flow.

# Why it changed
- The requested UX is to reset the center and right columns when starting a new ticket instead of showing secondary summary metrics.
- The new flow must follow the active PSA logic, which is currently Autotask, so the draft state uses the existing Autotask session-creation contract instead of introducing a new backend path.

# Impact (UI / logic / data)
- UI: sidebar shows one metric plus one CTA; `/triage/home` is now a tri-pane empty draft instead of the previous generic assistant chat view.
- Logic: both triage views now expose a `New Ticket` callback; ticket creation continues to use the existing frontend request to `/triage/sessions`.
- Data: no schema or backend contract changes; the draft submits `ticket_id`, optional `org_id`, and `created_by=web_ui` exactly as before.

# Files touched
- `apps/web/src/components/ChatSidebar.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `apps/web/messages/en.json`
- `tasks/todo.md`

# Date
- 2026-02-28
