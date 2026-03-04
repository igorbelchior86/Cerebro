# Inbox Domain Snapshot Placeholder Guard
# What changed
- Updated workflow inbox hydration local-snapshot promotion to ignore placeholder values.
- `existingSnapshotCompany/requester/status/assigned_to` now use meaningful-value selection instead of non-empty selection.
- Added regression test to ensure remote Autotask snapshot still runs when local domain snapshots contain placeholders.

# Why it changed
- Tickets with `Unknown org/requester`, `-`, and `Unassigned` stored inside `domain_snapshots` were incorrectly considered hydrated.
- That blocked remote enrichment and kept sidebar cards stuck in fallback state until manual ticket-open flows changed the row.

# Impact (UI / logic / data)
- UI: Sidebar cards can recover from placeholder-contaminated snapshot state without manual per-ticket interaction.
- Logic: Local snapshot promotion and remote merge now follow the same “meaningful value” rule.
- Data: No schema changes.

# Files touched
- `apps/api/src/services/orchestration/ticket-workflow-core.ts`
- `apps/api/src/__tests__/services/ticket-workflow-core.test.ts`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-04
