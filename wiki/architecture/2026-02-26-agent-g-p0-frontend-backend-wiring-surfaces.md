# Agent G P0 Frontend/Backend Wiring Surfaces
# What changed
- Introduced a frontend-only P0 wiring layer in `apps/web` that composes existing backend routes into three operational surfaces:
- Workflow inbox (`/workflow/inbox`) + ticket detail (`/workflow/audit/:ticketId`, `/workflow/reconciliation-issues`, `/workflow/reconcile/:ticketId`)
- Technician trust-layer visibility (`/manager-ops/p0/ai-decisions`, `/manager-ops/p0/audit`)
- Manager ops snapshot (`/manager-ops/p0/visibility`) + rollout visibility (`/manager-ops/p0/rollout/policy`, `/manager-ops/p0/rollout/flags`)
- Added a shared `p0-ui-client` typed fetch layer and `usePollingResource` hook for consistent cookie-authenticated polling/error handling.

# Why it changed
- The repo had backend P0 services/routes but lacked an application-layer frontend composition boundary for internal validation workflows.
- A small, additive UI client/hook layer minimizes impact on existing chat/triage flows while making P0 routes operationally visible.

# Impact (UI / logic / data)
- UI: New routes render without modifying existing triage/chat route logic.
- Logic: Queue/SLA manager snapshot input is derived from workflow inbox projection via client-side mapping (`mapInboxToQueueSnapshot`) with explicit P0 heuristic labeling for SLA age buckets.
- Logic: Technician enrichment display is reconstructed from trust audit records because the trust store persists audits/AI decisions, not enrichment envelopes.
- Data: No write path added for read-only integrations; rollout endpoints are displayed read-only in this UI pass.

# Files touched
- `apps/web/src/lib/p0-ui-client.ts`
- `apps/web/src/hooks/usePollingResource.ts`
- `apps/web/src/components/p0/P0InboxPage.tsx`
- `apps/web/src/components/p0/P0WorkflowTicketPage.tsx`
- `apps/web/src/components/p0/P0ManagerOpsPage.tsx`
- `apps/web/src/app/[locale]/(main)/workflow/p0/page.tsx`
- `apps/web/src/app/[locale]/(main)/workflow/p0/[ticketId]/page.tsx`
- `apps/web/src/app/[locale]/(main)/manager-ops/p0/page.tsx`

# Date
- 2026-02-26
