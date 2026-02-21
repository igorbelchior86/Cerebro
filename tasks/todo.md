# Task: Align diagnose -> playbook checklist contract

**Status**: completed
**Started**: 2026-02-21

## Plan
- [x] Step 1: Audit diagnose/playbook contract and locate mismatch points
- [x] Step 2: Implement deterministic hypothesis-to-checklist alignment in playbook generation path
- [x] Step 3: Verify with typecheck and targeted behavioral inspection
- [x] Step 4: Update wiki docs (feature + changelog)

## Open Questions
- Should checklist enforce at least one action per top-3 hypothesis or only top-1/top-2?

## Progress Notes
- Initialized workflow-orchestrator artifacts.
- Root cause confirmed: playbook prompt was centered on primary hypothesis and did not enforce checklist coverage across H2/H3.
- Implemented mandatory checklist hypothesis tags ([H1]/[H2]/[H3]) and post-generation alignment validation with one repair pass.
- API typecheck passed.
- Wiki updated with feature and changelog entries.

## Review
- What worked: Contract-level enforcement in the writer solved the mismatch without changing diagnosis schema.
- What was tricky: Keep enforcement deterministic while still allowing model flexibility; solved with tag rule + validator + single repair pass.
- Time taken: ~30 min.
