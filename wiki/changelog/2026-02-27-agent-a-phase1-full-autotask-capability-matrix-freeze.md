# Title
Agent A: Phase 1 Full Autotask API Capability Matrix Freeze

# What changed
Added the canonical Phase 1 full Autotask capability matrix and aligned shared contracts/types to expose domain operations, status classification, and per-operation requirements. Linked the prior two-way freeze to the new matrix artifact.

# Why it changed
To provide a frozen source of truth covering 100% approved API-manageable scope with explicit exclusions and deterministic contract consumption by other agents.

# Impact (UI / logic / data)
UI: None.
Logic: Contract surface now includes matrix-level status and requirements beyond minimum command map.
Data: No DB changes; operational expectation contracts (audit/reconcile) were formalized.

# Files touched
- docs/contracts/autotask-phase1-full-api-capability-matrix.md
- packages/types/src/autotask-two-way-contract.ts
- docs/contracts/autotask-phase1-two-way-freeze.md
- tasks/todo.md

# Date
2026-02-27
