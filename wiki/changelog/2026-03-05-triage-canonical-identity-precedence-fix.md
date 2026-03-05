# Triage canonical identity precedence fix
# What changed
- Updated `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx` so the triage page now prefers canonical identity fields from the workflow inbox/sidebar state before falling back to `/playbook/full-flow`.
- The full-flow merge now resolves `requester` using canonical workflow/sidebar data first, then `contact_name`, then SSOT/full-flow fallbacks.
- The same merge now resolves `org` from the workflow inbox/sidebar before SSOT/full-flow and preserves `contact_email` when already known locally.
- Added `contact_name` and `contact_email` to the typed full-flow ticket payload used by the page.

# Why it changed
- The triage page was still mutating `sidebarTickets` after `GET /playbook/full-flow` and was treating the full-flow payload as more authoritative than the canonical workflow read model.
- When `/playbook/full-flow` returned stale or partial identity fields, it overwrote already-correct `Org` / `Requester` data in the left sidebar card and the right context panel.

# Impact (UI / logic / data)
- UI: selected ticket card and right context panel now stay aligned with canonical workflow identity data for `Org` and `Contact/Requester`.
- Logic: precedence is now `workflow inbox -> current sidebar ticket -> full-flow fallback` for identity display fields in triage.
- Data: no schema or migration changes.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`

# Date
- 2026-03-05
