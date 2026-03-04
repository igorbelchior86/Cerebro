# Autotask Canonical Ticket Creation Time
# What changed
- Backend workflow projection now resolves `created_at` using Autotask creation fields aliases: `createDateTime`, `createDate`, `created_at`, `createdAt`.
- `processAutotaskSyncEvent` and command-result local projection include the Autotask aliases when computing `created_at`.
- Inbox hydration now also repairs missing `created_at` from remote ticket snapshot when available.
- Autotask poller sync payload now forwards `created_at`, `createDateTime`, and `createDate`.
- Full-flow authoritative overlay now carries `created_at` from the Autotask ticket payload.
- Removed synthetic fallback by `ticket_number` for creation time in both backend inference and web sidebar adapter.

# Why it changed
- Ticket cards were showing incorrect alternating times (e.g., `7:00 AM` and `6:23 PM`) due to mixed temporal sources and heuristic fallback instead of the canonical Autotask creation timestamp.

# Impact (UI / logic / data)
- UI: sidebar card time now tracks Autotask creation timestamp when available and no longer uses synthetic date-from-ticket-number fallback.
- Logic: creation-time resolution is canonical-provider-first; missing canonical value remains empty instead of fabricated.
- Data: no schema change; runtime projection behavior updated.

# Files touched
- `apps/api/src/services/orchestration/ticket-workflow-core.ts`
- `apps/api/src/services/adapters/autotask-polling.ts`
- `apps/api/src/services/application/route-handlers/playbook-route-handlers.ts`
- `apps/api/src/services/orchestration/autotask-ticket-workflow-gateway.ts`
- `apps/api/src/services/autotask-ticket-workflow-gateway.ts`
- `apps/api/src/__tests__/services/ticket-workflow-core.test.ts`
- `apps/web/src/lib/workflow-sidebar-adapter.ts`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-04
