# Canonical-First Sidebar Read Model (No GET Hydration)
# What changed
- `GET /workflow/inbox` (`listInbox`) no longer performs read-time hydration (`hydrateMissingOrgRequester`); it now returns only the already-materialized inbox read model.
- Workflow core tests were updated to enforce read-only behavior on inbox reads (no remote snapshot fetch and no snapshot promotion during GET).
- Sidebar/UI paths were updated to avoid rendering textual fallback values like `Unknown` for canonical fields.
- Sidebar cards now render neutral skeleton placeholders for missing org/requester display values instead of textual placeholders.
- Context field derivation for Org/Contact/Issue Type/Sub-Issue Type/Priority/SLA now avoids `Unknown` fallback text and relies on canonical values or empty/loading representation.

# Why it changed
- The previous flow still corrected incomplete data during API reads, which created visual race conditions (`Unknown` first, corrected later).
- Canonical-first rendering requires hydration/canonicalization to happen before read time (ingest/reconcile/write path), not during `GET`.

# Impact (UI / logic / data)
- UI: Sidebar/context no longer oscillates through `Unknown` placeholders before canonical values arrive; missing values are rendered as skeleton/empty loading states.
- Logic: Inbox read path is deterministic and read-only, aligned with canonical-first contract.
- Data: No schema migration; read model semantics changed to disallow GET-side enrichment.

# Files touched
- `apps/api/src/services/orchestration/ticket-workflow-core.ts`
- `apps/api/src/__tests__/services/ticket-workflow-core.test.ts`
- `apps/api/src/__tests__/routes/autotask.sidebar-tickets.test.ts`
- `apps/web/src/lib/workflow-sidebar-adapter.ts`
- `apps/web/src/features/chat/sidebar/SidebarTicketCard.tsx`
- `apps/web/src/features/chat/sidebar/useSidebarState.ts`
- `apps/web/src/features/chat/sidebar/ChatSidebar.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`

# Date
- 2026-03-04
