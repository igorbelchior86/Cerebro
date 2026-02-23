# Refresh Button Restarts From Step 1 New Triage Session
# What changed
- Updated `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/playbook.ts` so `GET /playbook/full-flow?refresh=1` no longer only resets the current session state.
- The refresh flow now:
  - clears generated artifacts for the current session/ticket (playbook, llm outputs, validation, evidence pack, SSOT/artifacts caches)
  - marks the current `triage_sessions` row as `failed` with `last_error = 'manual refresh restart'`
  - creates a **new** `triage_sessions` row with status `pending` for the same ticket
  - continues the full-flow using the new session ID

# Why it changed
- The requirement was to guarantee that the center-column Refresh button brings the ticket back to **Step 1 (O Despertar / A Chegada)**.
- Reusing the same session after cleanup was a reset, but not a true “new arrival / new triage session” restart.

# Impact (UI / logic / data)
- UI: Refresh now maps to a true pipeline restart from a fresh triage session (same ticket).
- Logic: Full-flow refresh semantics are now “hard restart” rather than “clear and reuse session”.
- Data: Historical session row is preserved but marked as manually restarted; a new pending session is created.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/playbook.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`

# Date
- 2026-02-23
