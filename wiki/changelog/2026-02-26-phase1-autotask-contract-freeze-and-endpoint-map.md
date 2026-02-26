# Title
2026-02-26 - Phase 1 Autotask Contract Freeze + Endpoint Mapping

# What changed
Added a frozen shared type contract for Phase 1 Autotask two-way minimum commands and published a formal endpoint mapping document including required fields, idempotency strategy, retry policy, error classification, reconciliation model, audit requirements, and safe write scope.

# Why it changed
To lock down integration behavior before further engine coding and keep the launch policy unchanged (Autotask two-way only; all other integrations read-only).

# Impact (UI / logic / data)
UI: None.
Logic: Contract/endpoint/retry/error semantics are codified and cross-referenced from the execution guide.
Data: Audit/reconciliation schemas for Autotask command flows are now explicit and reusable.

# Files touched
- packages/types/src/autotask-two-way-contract.ts
- packages/types/src/index.ts
- docs/contracts/autotask-phase1-two-way-freeze.md
- Cerebro-Execution-Guide.md

# Date
2026-02-26
