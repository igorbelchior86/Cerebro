# Changelog - Agent B Phase 2 UX Hardening (Workflow States)
# What changed
- Added workflow action lifecycle UX in triage detail for `Edit Tech` with command submit/status polling/retry.
- Added frontend HTTP error classification and state mapping for `pending/retrying/failed/succeeded`.
- Updated P0 inbox/workflow ticket components with better retrying/failed rendering and recovery actions.
- Added smoke script validating status and HTTP classification mappings.

# Why it changed
- Meet UX hardening acceptance: no blank screens, explicit current state, explicit next action, and resilient degraded behavior.

# Impact (UI / logic / data)
- UI: More resilient command/reconcile feedback and read-only warning states.
- Logic: Shared deterministic state/error mapping.
- Data: unchanged.

# Files touched
- apps/web/src/lib/p0-ui-client.ts
- apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- apps/web/src/components/p0/P0WorkflowTicketPage.tsx
- apps/web/src/components/p0/P0InboxPage.tsx
- apps/web/scripts/workflow-ux-state-smoke.ts
- tasks/todo.md

# Date
- 2026-02-27
