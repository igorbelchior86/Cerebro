# PSA Semi-Total Parity Excluding Workflow Rules
# What changed
- Updated `/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx` to filter out Autotask notes that represent `Workflow Rule` events.
- Added richer note content composition for PSA notes:
  - if both `title/subject` and `body/noteText` exist, the feed renders both;
  - if only one exists, it renders the available field;
  - fallback remains `noteType`.
- Existing note merge, dedupe, visibility mapping, and chronological ordering were preserved.

# Why it changed
- The product goal is to make Cerebro behave like a UI skin for Autotask communications.
- The user explicitly excluded `Workflow Rule` events because they are operational noise, not meaningful technician communication.

# Impact (UI / logic / data)
- UI: The central feed now keeps more PSA communication context while removing workflow-rule noise.
- Logic: Autotask note projection now applies semantic filtering and preserves more note fields.
- Data: No schema changes; read-model projection only.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`
- `wiki/features/2026-02-27-psa-semi-total-parity-excluding-workflow-rules.md`

# Date
- 2026-02-27
