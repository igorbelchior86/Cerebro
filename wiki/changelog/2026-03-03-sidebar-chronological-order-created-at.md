# Sidebar Chronological Order by Ticket Creation Date
# What changed
- Workflow inbox now stores and preserves `created_at` for ticket rows.
- Autotask polling now sends `created_at` (`createDate`) in workflow sync payloads.
- Autotask workflow gateway snapshot now includes `created_at` when available.
- Sidebar adapter now prioritizes `row.created_at` and uses deterministic fallback (ticket number date) before `updated_at` fallback.
- Added regression test to guarantee explicit and inferred `created_at` behavior.

# Why it changed
- Sidebar ordering/grouping was using update/event timestamps in practice, causing legacy tickets to appear as if they were created today.
- This broke chronological organization in personal/global views when workflow inbox data lacked stable creation date.

# Impact (UI / logic / data)
- UI: Sidebar grouping and sorting now reflect ticket creation date more accurately, preventing old tickets from being grouped under current day.
- Logic: Workflow projection now infers/preserves creation date from payload/snapshot/ticket number.
- Data: No schema migration; in-memory/runtime workflow state now carries optional `created_at` in inbox entries.

# Files touched
- `apps/api/src/services/orchestration/ticket-workflow-core.ts`
- `apps/api/src/services/orchestration/autotask-ticket-workflow-gateway.ts`
- `apps/api/src/services/adapters/autotask-polling.ts`
- `apps/api/src/__tests__/services/ticket-workflow-core.test.ts`
- `apps/web/src/lib/p0-ui-client.ts`
- `apps/web/src/lib/workflow-sidebar-adapter.ts`
- `tasks/todo.md`

# Date
- 2026-03-03
