# Restore Ticket Intake List Route for UI Sidebar
# What changed
- Restored mounting of `/ticket-intake` routes in the API server because the web sidebar still reads local inbox/session list data from `/ticket-intake/list`.
- Kept `TicketIntakePollingService` disabled and kept email fallback removed from `PrepareContext`.

# Why it changed
- Removing the route broke the UI sidebar loading/history view, even though the app server and web server were healthy.
- The route is currently used as a local data/query API for the UI, not only for email polling ingestion.

# Impact (UI / logic / data)
- UI: Sidebar ticket list loads again.
- Logic: Email polling remains disabled; Autotask-only intake policy remains in effect.
- Data: No schema changes.

# Files touched
- `apps/api/src/index.ts`
- `wiki/changelog/2026-02-25-restore-ticket-intake-list-route-for-ui-sidebar.md`

# Date
- 2026-02-25
