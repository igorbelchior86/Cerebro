# Title
Phase 1 Autotask Two-Way Engine: Explicit Assign/Status/Comment Command Handlers

# What changed
Added explicit `comment`/`note` command-handler support in the Autotask workflow gateway while preserving existing `assign`, `status`, and `update` flows. Also extended local workflow projection so comment/note aliases are persisted to inbox comments.

# Why it changed
Phase 1 scope requires direct command handlers for assign, status update, and comment/note on Autotask two-way happy path. The previous implementation supported comments only through `update` payload coupling.

# Impact (UI / logic / data)
- UI: No direct UI changes.
- Logic: Workflow command execution now supports explicit `comment` and `note` command types.
- Data: Inbox projection now accepts `comment_body` and note aliases (`note_body` / `noteText`) for comment persistence.

# Files touched
- `apps/api/src/services/ticket-workflow-core.ts`
- `apps/api/src/services/autotask-ticket-workflow-gateway.ts`
- `apps/api/src/__tests__/services/ticket-workflow-core.test.ts`
- `apps/api/src/__tests__/services/autotask-ticket-workflow-gateway.test.ts`

# Date
2026-02-26
