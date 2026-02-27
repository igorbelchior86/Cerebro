# Title
Dual-Channel Message Pipeline for Autotask (Rich Internal + Plain External)

# What changed
Implemented backend text normalization for workflow write operations so that rich/markdown/html content is preserved in Cerebro context while Autotask receives plain structured text. The normalization now runs in command handlers for comment notes, legacy comment updates, ticket note updates, and time entry create/update summary notes.

# Why it changed
Autotask write surfaces for notes/time entries do not reliably preserve rich formatting from API payloads. The workflow needed a compatibility layer to keep internal rich authoring while ensuring external notifications remain readable and deterministic in plain text.

# Impact (UI / logic / data)
- UI: No immediate visual change required for this step; existing rich authoring can be preserved in internal payload fields.
- Logic: Gateway now enforces rich->plain normalization at Autotask write boundary.
- Data: Internal workflow projection now prioritizes `*_rich` comment fields for local display/fingerprint when present, while external Autotask write uses normalized plain text.

# Files touched
- apps/api/src/services/autotask-text-normalizer.ts
- apps/api/src/services/autotask-ticket-workflow-gateway.ts
- apps/api/src/services/ticket-workflow-core.ts
- apps/api/src/__tests__/services/autotask-ticket-workflow-gateway.test.ts
- tasks/todo.md
- tasks/lessons.md
- wiki/features/2026-02-27-dual-channel-rich-to-autotask-plain.md

# Date
2026-02-27
