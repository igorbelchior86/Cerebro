# Sidebar Order by Ticket Sequence (TYYYYMMDD.NNNN)
# What changed
- Updated sidebar list ordering logic in `/ticket-intake/list` to prioritize canonical ticket sequence from `ticket_id` (`TYYYYMMDD.NNNN`) instead of mutable timestamps.
- Applied the same ordering policy in SQL and in the final in-memory sort to avoid post-query reorder drift.

# Why it changed
- `T20260220.0005` was jumping to the top due timestamp-based ordering after pipeline reprocessing, despite being an older ticket sequence.

# Impact (UI / logic / data)
- UI: ticket cards follow expected sequence order; older suffixes no longer jump above newer ones.
- Logic: deterministic ranking now aligns with ticket identity semantics.
- Data: no schema changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/ticket-intake.ts

# Date
- 2026-02-21
