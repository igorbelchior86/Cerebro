# Title
Wave 0 Exclusion Contract Surface Expansion

# What changed
Expanded the shared Autotask Phase 1 contract surface with concrete command/query schemas for every previously excluded capability row.

# Why it changed
The matrix previously identified exclusions but did not provide implementation-ready payload/query contracts. Wave 0 formalizes those schemas for deterministic downstream implementation.

# Impact (UI / logic / data)
UI: None.
Logic: New typed contracts define required fields, aliases, validations, endpoint targets, and test expectations for excluded operations.
Data: No schema migration or runtime write-path change in this wave.

# Files touched
- packages/types/src/autotask-two-way-contract.ts
- docs/contracts/autotask-phase1-full-api-capability-matrix.md
- apps/api/src/__tests__/contracts/autotask-phase1-exclusion-contracts.test.ts
- tasks/todo.md

# Date
2026-02-27
