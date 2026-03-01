# Full Flow Atomic Background Claim

# What changed
- Added an atomic database-backed session claim before `GET /playbook/full-flow` starts background processing.
- The route now updates `triage_sessions.status` to `processing` only when it successfully claims a session in a safe state (`pending`, `failed`, or stale `processing`).
- The background path now marks the session with the validation result status when validation blocks playbook generation, instead of leaving the session in an ambiguous processing state.

# Why it changed
- The `full-flow` route was starting background work using only a process-local `Set` (`fullFlowInFlight`).
- That did not coordinate with `triageOrchestrator`, retry sweeps, manual refreshes, or another API process.
- The result was a real overlap risk: multiple actors could write the same `triage_sessions`, `llm_outputs`, `validation_results`, and `playbooks` for the same ticket/session.

# Impact (UI / logic / data)
- UI: Reduces inconsistent or flapping ticket state during repeated polling and refresh cycles.
- Logic: Background work for `full-flow` now has compare-and-set style ownership at the session row level.
- Data: Prevents duplicate or overlapping writes to the same session artifacts and preserves a clearer terminal session status when validation stops the pipeline.

# Files touched
- `apps/api/src/routes/playbook.ts`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-01
