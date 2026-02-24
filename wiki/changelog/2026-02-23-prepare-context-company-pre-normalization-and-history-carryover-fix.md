# Prepare Context Company Pre Normalization And History Carryover Fix
# What changed
- Company inference now also evaluates the pre-normalization ticket narrative (`originalTicketNarrative`) so org/company clues removed during text cleanup can still be captured.
- Round 8 broad history correlation now always reassigns `relatedCases` (including empty), preventing stale/carryover related cases from earlier rounds when the broad history step is blocked or returns no matches.
- Round 8 source finding summary/matched status now reflects the blocked state more accurately when org/company scope is missing.

# Why it changed
- Ticket `T20260223.0006` still produced `company=unknown` because the normalization step removed the “created for CAT Resources, LLC” boilerplate before company inference ran.
- Even after blocking unscoped broad history in the appendix, `evidence_pack.related_cases` still showed unrelated cases because old results were carried over from earlier rounds.

# Impact (UI / logic / data)
- UI: Company/org should resolve more often from intake email boilerplate, improving center/right panel consistency with the sidebar.
- Logic: Broad history no longer leaves stale related cases in the evidence pack when blocked by missing scope.
- Data: `ticket_ssot.company`, `evidence_pack.org`, and `evidence_pack.related_cases` should better reflect real scope and current round results.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-02-23
