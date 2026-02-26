# Agent G UI Integration Refactor (Tri-Pane Canonical P0)
# What changed
- Refactored P0 frontend integration into the existing tri-pane Cerebro UI shell.
- Sidebar now prioritizes `/workflow/inbox` (merged with legacy metadata source for display continuity).
- Center pane now shows compact workflow runtime + trust signals (audit/reconcile/AI/read-only provider statuses) in-context.
- Right panel context now includes P0 launch policy, AI handoff/confidence, and read-only enrichment provider statuses.
- Standalone P0 pages are kept as internal validation harnesses and removed from primary nav.

# Why it changed
- Corrective change to avoid parallel product UX and preserve the existing Cerebro interaction model as the primary experience.

# Impact (UI / logic / data)
- UI: Existing tri-pane remains primary and gains P0 visibility.
- Logic: Added sidebar adapter + ticket-scoped P0 polling integration in `triage/[id]`.
- Data: Reused existing backend P0 routes only; no backend changes.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `apps/web/src/lib/workflow-sidebar-adapter.ts`
- `apps/web/src/app/[locale]/(main)/layout.tsx`
- `apps/web/src/components/p0/P0InboxPage.tsx`
- `apps/web/src/components/p0/P0WorkflowTicketPage.tsx`
- `apps/web/src/components/p0/P0ManagerOpsPage.tsx`

# Date
- 2026-02-26
