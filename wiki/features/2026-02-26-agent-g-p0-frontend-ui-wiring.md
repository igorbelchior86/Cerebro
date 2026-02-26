# Agent G P0 Frontend UI Wiring (Inbox + Technician Context + Manager Ops)
# What changed
- Added visible P0 frontend routes and screens in `apps/web` for:
- `/workflow/p0` inbox projection (list + refresh + command worker trigger)
- `/workflow/p0/[ticketId]` workflow ticket detail + technician context panel
- `/manager-ops/p0` manager operational visibility dashboards
- Added route/navigation links in main layout for P0 Inbox and Manager Ops.
- Added polling-based frontend data fetching and typed API client for `/workflow/*` and `/manager-ops/p0/*`.
- Added explicit launch policy messaging in UI (Autotask `TWO-WAY`; IT Glue/Ninja/SentinelOne/Check Point `READ-ONLY`).

# Why it changed
- Phase/P0 backend capabilities already existed, but there were no visible UI surfaces wired to validate the workflow, technician context, and manager ops flows end-to-end from the frontend.
- Internal validation needs a reliable UI to inspect workflow state, AI decisions, audit signals, and degraded behavior before external launch.

# Impact (UI / logic / data)
- UI: New P0 pages and navigation entry points are now visible in the web app.
- UI: Technician context panel shows AI triage/handoff plus read-only enrichment status/evidence visibility from trust-layer audit signals.
- UI: Manager ops page shows queue/SLA snapshot, AI/audit visibility, QA sampling, integrity checks, and rollout posture (read-only display).
- Logic: Added polling hook and client-side queue snapshot mapping from workflow inbox to manager visibility input.
- Data: No backend schema changes. Frontend consumes existing protected API routes only.

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
