# Title
Phase 1 Autotask Two-way Contract Freeze (Minimum Commands)

# What changed
Froze the Phase 1 Autotask two-way minimum command contract (`assign`, `status_update`, `comment_note`) as shared typed artifacts and published the endpoint mapping/reconciliation/audit/safe-write-scope specification backed by official Autotask REST docs.

# Why it changed
Phase 1 requires contract and endpoint freezing before additional engine behavior to prevent drift in write semantics, idempotency policy, and operational safety.

# Impact (UI / logic / data)
UI: None.
Logic: Command payloads, endpoint mapping, retry policy, and error-classification rules are now explicit and stable for Phase 1.
Data: Audit model required fields and reconciliation mismatch classes are standardized for Autotask two-way writes.

# Files touched
- packages/types/src/autotask-two-way-contract.ts
- packages/types/src/index.ts
- docs/contracts/autotask-phase1-two-way-freeze.md
- Cerebro-Execution-Guide.md

# Date
2026-02-26
