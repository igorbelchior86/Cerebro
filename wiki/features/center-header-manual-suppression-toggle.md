# Center Header Manual Suppression Toggle
# What changed
- Added a new icon button in the triage center-column header, placed between the `Playbook ready` badge and the refresh button.
- Clicking the icon toggles manual suppression for the currently selected ticket.
- Added backend persistence for manual suppression in `tickets_processed.manual_suppressed` (plus timestamp) and a new toggle endpoint.
- Updated `/email-ingestion/list` to merge automatic suppression classification with persisted manual suppression and expose `manual_suppressed`.
- Added backend enforcement guards so manually suppressed tickets do not trigger background pipeline processing in `full-flow` / orchestrator retries.
- Fixed sidebar list query semantics so manually suppressed tickets without a triage session still appear in the sidebar (when suppressed filter is off) and are counted in the suppressed badge.

# Why it changed
- The existing suppression behavior is automatic and derived from email classification, but the user needs a quick explicit action to manually send the current ticket to the suppressed group.
- Manual suppression is an operational control, not just a UI category: backend persistence is required to avoid spending pipeline/LLM tokens on tickets the user explicitly suppressed.

# Impact (UI / logic / data)
- UI: New header action button with active/inactive visual state and accessible labels (`aria-label`, `aria-pressed`).
- Logic: Effective suppression is now `automatic suppression OR manual backend suppression`; manually suppressed tickets are blocked from background processing.
- Logic: Sidebar list is anchored on `tickets_processed` (inbox), with session/pipeline data as optional joins, preventing visibility/count gaps for unsessioned suppressed tickets.
- Data: New DB columns on `tickets_processed` (`manual_suppressed`, `manual_suppressed_at`) and new endpoint `PATCH /email-ingestion/tickets/:ticketId/manual-suppression`.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/home/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatSidebar.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/email-ingestion.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/playbook.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/triage-orchestrator.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/db/migrations/008_tickets_processed_manual_suppression.sql
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md

# Date
- 2026-02-24
