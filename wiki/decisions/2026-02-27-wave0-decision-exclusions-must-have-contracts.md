# Title
Decision: Every Phase 1 Exclusion Must Have an Implementation Contract

# What changed
Established that each `excluded_by_permission` and `excluded_by_api_limitation` matrix row must carry a concrete implementation contract (endpoint(s), payload/query schema, validation, target module, and required test).

# Why it changed
This prevents ambiguous exclusions and allows execution planning without scope drift, while preserving policy guardrails and runtime safety boundaries.

# Impact (UI / logic / data)
UI: None.
Logic: Exclusions become explicit backlog contracts instead of undefined placeholders.
Data: No runtime data-path changes in Wave 0.

# Files touched
- docs/contracts/autotask-phase1-full-api-capability-matrix.md
- packages/types/src/autotask-two-way-contract.ts
- apps/api/src/__tests__/contracts/autotask-phase1-exclusion-contracts.test.ts
- tasks/todo.md

# Date
2026-02-27
