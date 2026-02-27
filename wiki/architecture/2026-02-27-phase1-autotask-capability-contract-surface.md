# Title
Phase 1 Autotask Capability Contract Surface (Canonical)

# What changed
Expanded `packages/types/src/autotask-two-way-contract.ts` to include canonical capability-domain/operation contracts and per-operation requirements, aligned to the new matrix document.

# Why it changed
The previous contract freeze focused on minimum write commands only. Agent A required a full Phase 1 API-manageable surface contract so multiple agents can consume the same status/requirement model deterministically.

# Impact (UI / logic / data)
UI: None.
Logic: Shared types now expose explicit capability status and operation requirements for all approved domains.
Data: No schema migration; contract-level semantics are expanded for compile-time and documentation-driven enforcement.

# Files touched
- packages/types/src/autotask-two-way-contract.ts
- docs/contracts/autotask-phase1-full-api-capability-matrix.md
- docs/contracts/autotask-phase1-two-way-freeze.md
- tasks/todo.md

# Date
2026-02-27
