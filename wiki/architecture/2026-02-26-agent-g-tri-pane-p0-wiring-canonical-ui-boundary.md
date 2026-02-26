# Agent G Tri-Pane P0 Wiring and Canonical UI Boundary
# What changed
- Re-established the existing tri-pane Cerebro UI as the canonical frontend composition boundary for P0 workflows.
- Introduced a frontend adapter (`workflow-sidebar-adapter`) that maps `/workflow/inbox` projection rows into the existing `ChatSidebar` `ActiveTicket` view model as the canonical sidebar source.
- Added ticket-scoped P0 polling in `triage/[id]` for workflow audit/reconciliation and trust-layer signals (`/manager-ops/p0/ai-decisions`, `/manager-ops/p0/audit`) without replacing center/right pane components.
- Exposed internal manager/workflow harness routes through contextual links inside the existing shell instead of primary navigation.

# Why it changed
- The previous route-level P0 screens were useful for validation but violated the intended UX architecture by introducing a parallel operator experience.
- The correct architectural move is an adapter/view-model refactor that feeds P0 backend outputs into the established shell components.

# Impact (UI / logic / data)
- UI: No shell replacement; `ResizableLayout`, `ChatSidebar`, center timeline/messages, and `PlaybookPanel` remain the main composition.
- Logic: Sidebar list now uses workflow inbox as primary source and preserves UI metadata via merge strategy to avoid regressions.
- Logic: Right panel P0 enrichment visibility is represented through trust audit-derived status cards because the backend persists audit/AI decision records but not retrievable enrichment envelopes.
- Data: Manager ops queue/SLA aggregate view remains on temporary internal route (`/manager-ops/p0`) and is linked contextually from the tri-pane shell for internal validation.

# Files touched
- `apps/web/src/lib/workflow-sidebar-adapter.ts`
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `apps/web/src/app/[locale]/(main)/layout.tsx`

# Date
- 2026-02-26
