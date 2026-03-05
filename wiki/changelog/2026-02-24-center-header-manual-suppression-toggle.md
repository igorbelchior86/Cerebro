# 2026-02-24 Center Header Manual Suppression Toggle
# What changed
- Added a manual suppression toggle icon to the triage center header (between `Playbook ready` and refresh).
- Added backend manual suppression persistence in `tickets_processed` (`manual_suppressed`, `manual_suppressed_at`) and a toggle endpoint (`PATCH /ticket-intake/tickets/:ticketId/manual-suppression`).
- Updated `/ticket-intake/list` to merge automatic classifier suppression with persisted manual suppression and return `manual_suppressed`.
- Added backend guards in `triageOrchestrator` and `/playbook/full-flow` to skip background pipeline processing for manually suppressed tickets.
- Updated center-column UI to call the backend toggle endpoint and reflect persisted state in the sidebar immediately.

# Why it changed
- Users needed a simple explicit way to manually suppress the current ticket, and that suppression must prevent unnecessary pipeline/token spend.

# Impact (UI / logic / data)
- UI: New header icon button with active state.
- Logic: Manual suppression is merged with automatic suppression for sidebar visibility/filtering, and manually suppressed tickets are blocked from pipeline/background processing.
- Data: DB migration adds manual suppression columns to `tickets_processed`; new backend toggle endpoint persists the state.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/home/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatSidebar.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/ticket-intake.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/playbook.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/triage-orchestrator.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/db/migrations/008_tickets_processed_manual_suppression.sql

# Date
- 2026-02-24
