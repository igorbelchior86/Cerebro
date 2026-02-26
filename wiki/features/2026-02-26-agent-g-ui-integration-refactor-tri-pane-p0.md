# Agent G UI Integration Refactor: P0 in Existing Tri-Pane Cerebro UX
# What changed
- Refactored the P0 frontend wiring to integrate backend P0 capabilities into the existing Cerebro tri-pane UI shell (sidebar + center timeline + right context/playbook panel).
- Updated the existing tri-pane sidebar ticket loading to prioritize `/workflow/inbox` as the canonical inbox source, using `/workflow/inbox` as the canonical inbox source for the tri-pane sidebar.
- Added in-context P0 workflow/trust signals in the existing center pane (workflow runtime, audit/reconciliation visibility, AI handoff status, read-only provider signal badges).
- Added P0 AI/read-only enrichment visibility in the existing right-side context area (PlaybookPanel context cards) without replacing the panel structure.
- Kept standalone P0 pages (`/workflow/p0*`, `/manager-ops/p0`) as temporary internal validation harnesses and removed them from primary navigation.

# Why it changed
- The previous standalone P0 pages created a parallel product experience, which diverged from the intended Cerebro UX direction.
- The product baseline for operators/technicians is the existing tri-pane interface, so P0 capabilities must appear inside that shell to preserve IA, interaction model, and visual continuity.

# Impact (UI / logic / data)
- UI: Existing tri-pane is now the primary P0 experience (left pane inbox + center workflow/AI flow + right context panel).
- UI: Launch policy messaging (`Autotask two-way`, others read-only) appears in-context in the existing shell.
- UI: Standalone P0 pages remain available but clearly labeled as internal validation harnesses.
- Logic: Added workflow inbox -> sidebar adapter/merge layer to preserve legacy visual metadata while using P0 workflow projection as source of truth.
- Data: No backend schema/endpoint changes; frontend consumes existing `/workflow/*` and `/manager-ops/p0/*` routes.

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
