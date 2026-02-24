# Diagnose Grounding Calibration and Overreach Downgrade

# What changed
- Implemented deterministic post-processing of `Diagnose` hypotheses after LLM parsing:
  - `support_score`
  - `relevance_score`
  - `grounding_status` (`grounded|partial|weak|unsupported`)
  - `calibrated_confidence`
  - `playbook_anchor_eligible`
  - `confidence_explanation`
- Hypotheses are now recalibrated and re-ranked using evidence support, domain relevance, conflict penalties, missing-critical penalties, and the existing algorithmic baseline.
- Added a cross-domain relevance heuristic to reduce overreach (e.g. firewall/network hypotheses on email-change tickets).
- Added regression test validating downgrade of a cross-domain firewall hypothesis on an email rename ticket.

# Why it changed
- Phase 3 (`Diagnose`) was functionally working, but still produced occasional overreach and confidence inflation (e.g. plausible but weak hypotheses promoted too strongly).
- We needed stronger evidence grounding and confidence calibration to better match the intended “Nível 3” reasoning behavior.

# Impact (UI / logic / data)
- **UI**: Existing UI remains compatible because `confidence` still exists and is now the calibrated value.
- **Logic**: Diagnose output is more conservative and evidence-weighted; hypotheses with weak grounding or low domain relevance are downgraded.
- **Data**: No schema migration required. Additional hypothesis metadata is included in diagnosis payloads for downstream use/audit.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/diagnose.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/diagnose-calibration.test.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/packages/types/src/index.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-02-24
