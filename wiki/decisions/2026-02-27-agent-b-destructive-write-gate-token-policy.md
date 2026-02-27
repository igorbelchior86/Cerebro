# Title
Decision: Destructive write approval token gate for newly unblocked delete operations

# What changed
- Enforced `destructive_approval_token` as a mandatory gate for:
  - ticket delete
  - checklist item delete
  - time entry delete
- Rejection now happens during operation resolution before gateway execution.

# Why it changed
- Prompt B requires policy guardrails for new write operations.
- Delete operations require explicit operator approval to avoid unsafe fail-open writes.

# Impact (UI / logic / data)
- UI: no change.
- Logic: destructive commands are rejected with explicit policy reason when token is missing.
- Data: no schema changes; rejection is auditable through existing workflow audit trail.

# Files touched
- `apps/api/src/services/autotask-operation-registry.ts`
- `apps/api/src/services/ticket-workflow-core.ts`
- `apps/api/src/__tests__/services/autotask-operation-registry.test.ts`
- `apps/api/src/__tests__/services/ticket-workflow-core.test.ts`

# Date
2026-02-27
