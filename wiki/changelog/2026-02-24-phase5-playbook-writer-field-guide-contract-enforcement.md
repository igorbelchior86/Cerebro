# Phase 5 Playbook Writer: Field-Guide Contract Enforcement

# What changed
- Strengthened `PlaybookWriterService` to enforce the Phase 5 “Guia de Campo” contract with deterministic validation, not only prompt instructions.
- Updated playbook prompt to explicitly request sections aligned with the user contract:
  - `Context`
  - `Hypotheses`
  - `Checklist`
  - `Escalation`
  - plus `Verification` and `Rollback`
- Added a second repair pass when generated playbook is missing required sections.
- `validatePlaybookStructure()` now throws when required sections are missing instead of only logging warnings.
- Added `getMissingPlaybookSections()` helper to detect missing sections with alias support for backward compatibility:
  - `Context` or `Overview`
  - `Hypotheses` or `Root Cause`
  - `Checklist` or `Resolution Steps`
- Added structure tests for presence/absence of required sections.

# Why it changed
- The Phase 5 contract requires a practical field guide for technicians with mandatory structure (context, hypotheses, checklist, escalation).
- Previously, the writer prompt asked for a rich structure, but the post-generation validator only warned and did not enforce the contract.
- This allowed incomplete playbooks to pass even when key sections (especially `Escalation`) were missing.

# Impact (UI / logic / data)
- UI:
  - No UI code changes required; the UI continues to render Markdown.
  - Generated playbooks should now be more consistently structured and easier for technicians to scan.
- Logic:
  - Playbook generation now performs deterministic section validation and a repair retry before acceptance.
  - Generation fails explicitly if mandatory field-guide sections are still missing after repair.
  - Checklist-hypothesis alignment behavior remains intact and compatible with Phase 3 anchor eligibility logic.
- Data:
  - No schema changes or migrations.
  - `content_md` output becomes structurally more consistent.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/playbook-writer.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/playbook-writer-structure.test.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-02-24
