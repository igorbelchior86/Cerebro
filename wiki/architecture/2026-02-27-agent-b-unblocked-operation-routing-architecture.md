# Title
Unblocked Operation Routing Architecture (Prompt B)

# What changed
- Introduced a full operation-to-handler routing layer that now maps every Prompt A exclusion contract operation into runtime execution paths.
- Centralized payload validation and destructive-write gate checks at operation-resolution time.
- Kept workflow idempotency primitive unchanged (tenant + idempotency_key replay behavior in core).

# Why it changed
- Runtime previously covered only the minimal safe-write subset.
- Prompt B requires complete operational routing coverage for all newly unblocked command/query operations.

# Impact (UI / logic / data)
- UI: unchanged.
- Logic: expanded deterministic routing and validation before command execution.
- Data: no DB changes; audit events now include operation metadata for broader command classes.

# Files touched
- `apps/api/src/services/autotask-operation-registry.ts`
- `apps/api/src/services/autotask-ticket-workflow-gateway.ts`
- `apps/api/src/services/ticket-workflow-core.ts`
- `apps/api/src/clients/autotask.ts`

# Date
2026-02-27
