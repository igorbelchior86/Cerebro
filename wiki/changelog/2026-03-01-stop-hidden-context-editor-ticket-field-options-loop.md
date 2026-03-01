# Stop Hidden Context Editor Ticket Field Options Loop

# What changed
- Disabled the draft context editor whenever the hidden draft workspace becomes inactive.
- Prevented ticket field option caches from being rewritten with empty arrays in the context editor flows.
- Applied the empty-cache guard to both the hidden draft workspace and the ticket page context editor.

# Why it changed
- The ticket page showed intermittent `Network Error` even while `/playbook/full-flow` was still returning `200`.
- Background hidden UI state could keep a context editor active and repeatedly hit `ticket-field-options`.
- When the backend degraded to an empty list, the frontend kept rewriting empty cache state and re-triggering the same request loop.

# Impact (UI / logic / data)
- UI: Stops hidden background metadata storms that could surface as intermittent connection banners on the ticket page.
- Logic: Context editor fetches now stop when the draft workspace is inactive, and empty degraded responses no longer create request loops.
- Data: No persistence or schema impact.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-01
