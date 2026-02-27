# Title
Wave 0 Exclusion Burn-Down Plan and Contract Expansion

# What changed
Added an implementation-ready Wave 0 burn-down table to the full Phase 1 capability matrix, converting every `excluded_*` row into explicit actionable items with endpoint, payload/validation, target module, and test requirement.

# Why it changed
Agent A needed to make all current exclusions executable as engineering backlog contracts without implementing runtime handlers.

# Impact (UI / logic / data)
UI: None.
Logic: Exclusions now have deterministic implementation specs for B/C execution.
Data: No runtime data mutation; contract documentation scope only.

# Files touched
- docs/contracts/autotask-phase1-full-api-capability-matrix.md
- packages/types/src/autotask-two-way-contract.ts
- apps/api/src/__tests__/contracts/autotask-phase1-exclusion-contracts.test.ts
- tasks/todo.md

# Date
2026-02-27
