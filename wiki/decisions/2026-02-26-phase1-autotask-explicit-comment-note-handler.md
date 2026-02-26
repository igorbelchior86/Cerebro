# Title
Decision: Keep `update` Command Backward Compatibility and Add Explicit `comment`/`note` Handlers

# What changed
Kept existing `update` behavior intact and introduced explicit `comment`/`note` command types for Autotask note writes.

# Why it changed
This minimizes behavioral risk for existing callers while satisfying the Phase 1 contract that requires dedicated command handlers for assign/status/comment workflows.

# Impact (UI / logic / data)
- UI: None.
- Logic: Command routing now supports both legacy `update` comment usage and explicit comment/note commands.
- Data: No database changes; audit and workflow runtime formats remain compatible.

# Files touched
- `apps/api/src/services/ticket-workflow-core.ts`
- `apps/api/src/services/autotask-ticket-workflow-gateway.ts`
- `apps/api/src/__tests__/services/autotask-ticket-workflow-gateway.test.ts`

# Date
2026-02-26
