# Agent B Phase 2 UX Hardening - Workflow States
# What changed
- Added frontend workflow action state model for command lifecycle: `pending`, `retrying`, `failed`, `succeeded`.
- Implemented `Edit Tech` command flow in canonical triage detail UI (existing dev tools panel), including submit, status polling, and manual retry.
- Added actionable error messaging for `401/403/429/5xx` via centralized frontend error mapping.
- Improved P0 workflow pages to expose reconcile state transitions and retry action without blank/error-only screens.

# Why it changed
- Workflow actions previously exposed only generic success/failure messages, without clear technical status or next action.
- UX acceptance required explicit pending/retrying/failed visibility and recovery paths.

# Impact (UI / logic / data)
- UI: New inline action + status badges/messages in triage dev tools panel and improved reconcile status feedback in P0 workflow pages.
- Logic: Deterministic mapping from backend command execution status to UX state.
- Data: No backend schema change; frontend consumes existing `/workflow/commands` and `/workflow/commands/:id` contracts.

# Files touched
- apps/web/src/lib/p0-ui-client.ts
- apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- apps/web/src/components/p0/P0WorkflowTicketPage.tsx
- apps/web/src/components/p0/P0InboxPage.tsx
- apps/web/scripts/workflow-ux-state-smoke.ts
- tasks/todo.md

# Date
- 2026-02-27
