# Full-Flow Background Last Error Persistence

# What changed
- Updated `/playbook/full-flow` background processing error handler to persist `triage_sessions.last_error` when background execution fails or is deferred to pending.

# Why it changed
- Tickets refreshed through the UI were ending in `FAILED` with no error reason (`last_error = null`), making troubleshooting impossible.
- The orchestrator persisted errors correctly, but the route-level background processor did not.

# Impact (UI / logic / data)
- **UI**: Failed tickets now have a visible backend reason available for troubleshooting flows after refresh.
- **Logic**: Background route error handling now matches orchestrator observability behavior.
- **Data**: No schema changes; only `triage_sessions.last_error` is now populated on route-level background failures.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/playbook.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-02-24
