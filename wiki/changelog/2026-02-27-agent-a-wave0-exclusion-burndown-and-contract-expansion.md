# Title
Agent A Wave 0: Exclusion Burn-Down and Contract Expansion

# What changed
Added Wave 0 burn-down table for all excluded matrix rows and introduced concrete typed command/query contracts for each exclusion, plus a contract test that enforces 1:1 coverage.

# Why it changed
To make every exclusion implementation-ready for Agent B/C without runtime implementation in this wave.

# Impact (UI / logic / data)
UI: None.
Logic: Contract completeness and exclusion coverage are now testable.
Data: No DB change and no runtime mutation behavior change.

# Files touched
- docs/contracts/autotask-phase1-full-api-capability-matrix.md
- packages/types/src/autotask-two-way-contract.ts
- apps/api/src/__tests__/contracts/autotask-phase1-exclusion-contracts.test.ts
- tasks/todo.md

# Date
2026-02-27
