# Full-Flow Deterministic Artifact Selection
# What changed
- Updated `GET /playbook/full-flow` to read latest artifacts deterministically using `ORDER BY created_at DESC LIMIT 1` for:
- `evidence_packs`
- `llm_outputs` (`diagnose`, `playbook`)
- `validation_results`
- `playbooks` existing-row lookup for updates
- Added canonical `session` object in full-flow response payload.
- Applied same deterministic read pattern in other playbook retrieval endpoints (`POST /playbook`, `GET /playbook/:sessionId`, `GET /playbook/:sessionId/markdown`).

# Why it changed
- Multiple rows per session/step can exist during retries/resume flows.
- Reads without explicit ordering can return inconsistent artifacts between close polls, causing apparent UI “flip/flop”.

# Impact (UI / logic / data)
- UI: stable ticket narrative across short polling intervals.
- Logic: deterministic backend artifact selection for the full pipeline chain.
- Data: no schema change; query determinism hardening only.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/playbook.ts
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/features/pipeline-only-ticket-flow-stabilization.md

# Date
- 2026-02-21
