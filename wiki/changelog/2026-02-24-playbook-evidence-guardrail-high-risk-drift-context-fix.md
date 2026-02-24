# Playbook Evidence Guardrail High-Risk Drift Context Fix

# What changed
- Refined `shouldBlockPlaybookOutput(...)` so unsupported high-risk terms only block playbook generation when they appear as:
  - assertive/root-cause drift (e.g. compromise/malware as cause), or
  - incident-response style remediation steps (isolate/quarantine/reimage/etc.)
- Added `explainPlaybookGuardBlock(...)` and included guardrail reason in `PlaybookWriter` error messages.
- Added tests for incidental high-risk mentions (allowed) vs. unsupported assertive drift (blocked).

# Why it changed
- Ticket `T20260221.0001` (WiFi issue) was failing at Playbook generation with `Playbook guardrail blocked unsupported inference`.
- The previous guardrail was too broad and blocked any unsupported high-risk noun mention, even when incidental and not changing the root cause of the playbook.

# Impact (UI / logic / data)
- **UI**: Fewer false `FAILED` states on operational tickets due to playbook guardrail overblocking.
- **Logic**: Evidence guardrail remains strict for unsupported incident-response drift while allowing benign incidental mentions.
- **Data**: No schema changes. `triage_sessions.last_error` messages are now more diagnostic when this guardrail triggers.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/evidence-guardrails.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/playbook-writer.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/evidence-guardrails.test.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-02-24
