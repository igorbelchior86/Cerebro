# Agent G Decision: Canonical Tri-Pane UX vs P0 Harness Routes
# What changed
- Decided that the existing Cerebro tri-pane interface is the canonical P0 operator/technician experience.
- Reclassified previously added standalone P0 pages (`/workflow/p0`, `/workflow/p0/[ticketId]`, `/manager-ops/p0`) as temporary internal validation harnesses.
- Removed standalone P0 pages from primary navigation and labeled them explicitly as internal validation surfaces.
- Integrated launch policy messaging, workflow runtime signals, AI handoff visibility, and read-only enrichment status into the tri-pane UI instead.

# Why it changed
- Parallel standalone pages risk user confusion, duplicate UX paths, and drift from the product’s established interaction model.
- P0 launch validation requires route-level harnesses, but those should not become the default product UX.

# Impact (UI / logic / data)
- UI: Canonical flow remains tri-pane (`ChatSidebar` + center timeline + right `PlaybookPanel`).
- UI: Internal harnesses remain available for manager/debug validation and are explicitly labeled as non-primary.
- Logic: Workflow inbox and trust-layer signals are now surfaced in-context in the tri-pane shell rather than exclusively in standalone pages.
- Data: No read-only integration write affordances were introduced; UX continues to reflect `Autotask = TWO-WAY`, others `READ_ONLY`.

# Files touched
- `apps/web/src/app/[locale]/(main)/layout.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `apps/web/src/components/p0/P0InboxPage.tsx`
- `apps/web/src/components/p0/P0WorkflowTicketPage.tsx`
- `apps/web/src/components/p0/P0ManagerOpsPage.tsx`

# Date
- 2026-02-26
