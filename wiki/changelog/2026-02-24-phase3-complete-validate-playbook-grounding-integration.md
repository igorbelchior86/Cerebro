# Phase 3 Complete: Diagnose Grounding Metadata Integrated Into Validate & Playbook

# What changed
- Integrated strengthened Diagnose hypothesis metadata into `Validate & Policy` and `Playbook Writer`.
- `ValidatePolicyService` now reads `grounding_status`, `support_score`, `relevance_score`, `calibrated_confidence`, and `playbook_anchor_eligible` (when present).
- Added a hard quality stop when the top-ranked hypothesis is explicitly `unsupported`.
- Added advisory behavior when no hypothesis is `playbook_anchor_eligible` (investigative-only playbooks).
- Updated `PlaybookWriterService` prompt to include a `HYPOTHESIS QUALITY` section and prioritize `anchor=yes` hypotheses for root-cause/remediation sequencing.
- Fixed checklist-hypothesis alignment validation to preserve original `H1/H2/H3` labels after filtering out `anchor=no` hypotheses.
- Preserved backward compatibility for legacy diagnose payloads by treating missing `playbook_anchor_eligible` as compatible/default-anchor behavior.
- Added tests for validate-policy gating and playbook alignment with anchor eligibility.

# Why it changed
- Phase 3 required end-to-end strengthening, not only better hypothesis generation.
- Before this change, `Diagnose` produced richer metadata but `Validate` and `PlaybookWriter` ignored it, so weak/unsupported hypotheses could still anchor downstream steps.
- The integration closes that gap and reduces overreach by propagating evidence-grounding decisions through the rest of the pipeline.

# Impact (UI / logic / data)
- UI:
  - No breaking UI change. Existing `confidence` field remains available and continues to render.
  - Downstream playbooks should become more consistent with grounded hypotheses (less anchoring on weak/investigative hypotheses).
- Logic:
  - Validation now blocks playbook generation when the top diagnosis hypothesis is explicitly unsupported.
  - Validation emits advisory coherence violations when all hypotheses are non-anchor.
  - Playbook generation prefers anchor-eligible hypotheses and relaxes checklist mapping requirements for `anchor=no` hypotheses.
- Data:
  - No schema migration required.
  - Services consume additional optional hypothesis metadata fields emitted by Diagnose.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/validate-policy.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/playbook-writer.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/validate-policy-gates.test.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/playbook-writer-alignment.test.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-02-24
