# Full-Flow Canonical Ticket Payload (Center/Sidebar Split-Brain Fix)
# What changed
- `GET /playbook/full-flow` now returns a canonical `data.ticket` object (id, title, description, requester, company, created_at, priority) resolved from processed ticket data with pipeline fallback.
- Triage detail page switched center timeline metadata source to this canonical backend ticket payload.
- Center timeline still keeps monotonic snapshot behavior, but now snapshot is seeded by canonical backend payload instead of sidebar list state.
- Source precedence in center timeline is now backend-first (sidebar only as fallback).

# Why it changed
- Same ticket could oscillate between rich and placeholder text because center timeline fields were derived from sidebar polling state, not from a single backend contract.

# Impact (UI / logic / data)
- UI: center timeline remains consistent for the same ticket even when sidebar list refreshes.
- Logic: unified metadata source for the selected ticket (`playbook/full-flow` response contract).
- Data: no schema changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/playbook.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/features/pipeline-only-ticket-flow-stabilization.md

# Date
- 2026-02-21
