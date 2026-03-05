# SSOT + Pipeline Race Stabilization (3 Sections)
# What changed
- Added per-session in-flight guard in `GET /playbook/full-flow` to prevent duplicate concurrent background pipeline executions.
- Added conditional trigger for background processing only when artifacts are missing.
- Hardened triage page polling with stale-response guard (request sequence) and in-flight overlap protection.
- Updated ticket list fetch to include credentials and SSOT merge behavior that preserves meaningful ticket identity fields.
- Updated `/ticket-intake/list` status normalization to preserve `processing` and `failed`, and merge duplicate ticket rows without degrading meaningful fields.

# Why it changed
- Polling every 3s was repeatedly scheduling pipeline jobs and allowing overlapping responses to overwrite newer state.
- Sidebar data could regress from recognized values to placeholders (`Unknown`) due multi-source merge and refresh timing.
- This caused visible reconstruction across left/main/right sections and unstable counters.

# Impact (UI / logic / data)
- UI: Reduced flicker/rebuild across the three sections; ticket identity fields are stable.
- Logic: Background pipeline is effectively single-flight per session in runtime process.
- Data: No schema changes; normalization/merge semantics updated in API response assembly.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/playbook.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/ticket-intake.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx

# Date
- 2026-02-20
