# Playbook Writer Contamination Guard False Positive Fix

# What changed
- Narrowed `PlaybookWriter` contamination guard regex patterns to avoid blocking legitimate technical troubleshooting phrases.
- Allowed operational terms like `API response` and `debug logs` when they are not explicitly tied to LLM/model meta output.
- Added regression tests covering both allowed troubleshooting language and blocked model-meta leakage language.

# Why it changed
- Ticket `T20260221.0001` was failing consistently at `PlaybookWriter` even after `Prepare Context`, `Diagnose`, and `Validate & Policy` succeeded.
- Root cause was an over-broad contamination guard treating normal troubleshooting wording (`API response`, `debug logs`) as internal engine leakage.

# Impact (UI / logic / data)
- **UI**: Tickets that previously failed at playbook generation due to false positives can now complete and show playbooks.
- **Logic**: Contamination guard remains active for actual meta leakage (`LLM/model/prompt/json response`) while allowing legitimate playbook steps.
- **Data**: No schema changes. Affects playbook generation outcomes and reduces false `triage_sessions.last_error` contamination blocks.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/playbook-writer.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/playbook-writer-contamination.test.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-02-24
