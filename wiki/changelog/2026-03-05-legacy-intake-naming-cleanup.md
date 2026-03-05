# Legacy Intake Naming Cleanup

# What changed
- Renamed runtime files and module paths from legacy intake naming to `ticket-intake`:
  - `apps/api/src/routes/ingestion/ticket-intake.ts`
  - `apps/api/src/services/application/route-handlers/ticket-intake-route-handlers.ts`
  - `apps/api/src/services/adapters/ticket-intake-polling.ts`
  - `apps/api/src/services/ticket-intake-polling.ts`
- Updated API bootstrap import/mount to use `/ticket-intake` in `apps/api/src/index.ts`.
- Replaced all repository text references of legacy intake tokens with `ticket-intake` variants.
- Removed stale compiled artifacts in `apps/api/dist` that still contained legacy intake filenames.

# Why it changed
- Product direction explicitly requires no residual legacy intake naming in the codebase or file names.
- Keeping mixed legacy naming was causing confusion and incorrect architectural signaling.

# Impact (UI / logic / data)
- UI:
  - Frontend/backoffice callers must use `/ticket-intake` endpoints.
- Logic:
  - No behavior change in ticket intake flow; this is naming and route/module alignment.
- Data:
  - No schema/data model mutation; migration SQL text labels were renamed for consistency.

# Files touched
- `apps/api/src/index.ts`
- `apps/api/src/routes/ingestion/ticket-intake.ts`
- `apps/api/src/services/application/route-handlers/ticket-intake-route-handlers.ts`
- `apps/api/src/services/adapters/ticket-intake-polling.ts`
- `apps/api/src/services/ticket-intake-polling.ts`
- `apps/api/src/services/email/email-parser.ts`
- `apps/api/src/services/adapters/email/email-parser.ts`
- `apps/api/src/db/migrations/05-email-tickets.sql`
- `apps/web/src/features/chat/sidebar/useSidebarState.ts`
- `tasks/todo.md`
- `tasks/lessons.md`
- Multiple `wiki/` entries updated for naming consistency.

# Date
- 2026-03-05
