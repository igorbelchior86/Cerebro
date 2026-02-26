# Title
Decision: Freeze Autotask Phase 1 to Three Write Commands with Explicit Safe Scope

# What changed
Recorded the decision to allow only `assign`, `status_update`, and `comment_note` writes in Phase 1, with fixed idempotency/retry/error-classification rules and mandatory audit/reconciliation fields.

# Why it changed
Confining Phase 1 to the minimum operational command set lowers blast radius, preserves launch policy (`autotask` two-way only), and enables deterministic QA before broader write capabilities.

# Impact (UI / logic / data)
UI: None.
Logic: Any command outside the frozen set is out-of-scope for Phase 1.
Data: Audit/reconciliation contracts are now explicit inputs for runbooks and validation evidence.

# Files touched
- packages/types/src/autotask-two-way-contract.ts
- docs/contracts/autotask-phase1-two-way-freeze.md

# Date
2026-02-26
