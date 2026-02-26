# Title
Changelog: Phase 1 Autotask Command/Sync/Reconcile Engine Happy Path

# What changed
- Added `comment` and `note` workflow command types.
- Implemented explicit note write execution for `comment`/`note` commands in Autotask gateway.
- Extended inbox projection comment mapping to include note aliases.
- Added tests for explicit comment/note gateway behavior and terminal command error handling.
- Updated service-level happy-path test to cover `assign -> status -> comment` flow.

# Why it changed
To satisfy Phase 1 required scope and required tests for the Autotask two-way command/sync/reconcile engine.

# Impact (UI / logic / data)
- UI: No change.
- Logic: Expanded explicit command handler support and verification coverage.
- Data: No schema migration.

# Files touched
- `apps/api/src/services/ticket-workflow-core.ts`
- `apps/api/src/services/autotask-ticket-workflow-gateway.ts`
- `apps/api/src/__tests__/services/ticket-workflow-core.test.ts`
- `apps/api/src/__tests__/services/autotask-ticket-workflow-gateway.test.ts`

# Date
2026-02-26
