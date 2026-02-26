# Agent G P0 Frontend UI Wiring
# What changed
- Added P0 frontend routes/pages for workflow inbox, workflow ticket detail/technician context, and manager ops visibility.
- Added polling hook and typed API client for `/workflow/*` and `/manager-ops/p0/*` integration.
- Added main layout navigation links for P0 Inbox and Manager Ops.
- Added read-only launch policy messaging and degraded/access error states across the new P0 pages.

# Why it changed
- To expose existing P0 backend capabilities in the frontend for internal validation and operational readiness checks.

# Impact (UI / logic / data)
- UI: New internal validation surfaces are visible and navigable.
- Logic: Frontend performs periodic polling and client-side queue snapshot mapping for manager visibility.
- Data: Backend contracts reused; no schema or migration changes.

# Files touched
- `apps/web/src/app/[locale]/(main)/layout.tsx`
- `apps/web/src/app/[locale]/(main)/workflow/p0/page.tsx`
- `apps/web/src/app/[locale]/(main)/workflow/p0/[ticketId]/page.tsx`
- `apps/web/src/app/[locale]/(main)/manager-ops/p0/page.tsx`
- `apps/web/src/components/p0/P0InboxPage.tsx`
- `apps/web/src/components/p0/P0WorkflowTicketPage.tsx`
- `apps/web/src/components/p0/P0ManagerOpsPage.tsx`
- `apps/web/src/components/p0/P0UiPrimitives.tsx`
- `apps/web/src/hooks/usePollingResource.ts`
- `apps/web/src/lib/p0-ui-client.ts`

# Date
- 2026-02-26
