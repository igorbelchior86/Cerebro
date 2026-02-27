# Title
Decision: preserve legacy command compatibility behind frozen-matrix operation gate

# What changed
- Decided to keep existing legacy command types (`assign`, `status`, `comment`, `note`, `update`) available.
- Added canonical aliases required by frozen contracts (`update_assign`, `status_update`, `update_status`, `comment_note`, `create_comment_note`).
- Enforced matrix gate before execution and rejected out-of-scope legacy mutations.

# Why it changed
- Product/runtime compatibility requires existing command flows to continue working.
- Safety/contract compliance requires fail-closed behavior for operations not approved in Phase 1 matrix.

# Impact (UI / logic / data)
- UI: none.
- Logic: compatibility and compliance both enforced in a single resolution layer.
- Data: no schema changes; audit trail now carries explicit operation mapping metadata.

# Files touched
- `apps/api/src/services/autotask-operation-registry.ts`
- `apps/api/src/services/ticket-workflow-core.ts`
- `apps/api/src/services/autotask-ticket-workflow-gateway.ts`

# Date
2026-02-27
