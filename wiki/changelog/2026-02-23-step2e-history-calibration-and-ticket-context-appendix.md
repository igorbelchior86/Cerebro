# Step 2E History Calibration And Ticket Context Appendix
# What changed
- Extended `2e` in `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts` so historical correlation is now used not only for case matching but also for SSOT/enrichment confidence calibration.
- Added deterministic `history_confidence_calibration` logic that cross-checks selected enrichment fields (user/device/network/infra) against related historical cases and applies conservative confidence adjustments (`boost`, `decrease`, `context_only`).
- Added contradiction detection (initial conservative implementation for ISP/provider mismatches in historical context).
- Added a new separate artifact `ticket_context_appendix` (persisted by ticket) to store:
  - history correlation metadata (search terms, strategies, matched case IDs)
  - history confidence calibration adjustments and contradictions
  - fusion summary snapshot (counts + LLM usage)
- Exposed `ticket_context_appendix` in `/playbook/full-flow` and added `refresh=1` cleanup support.
- Added DB migration `013_ticket_context_appendix.sql`.

# Why it changed
- Historical search should not only find similar cases but also validate or challenge current fused SSOT assumptions.
- Keeping this as an appendix preserves a clean SSOT for UI/logic consumers while maintaining an auditable technical trail for confidence tuning.

# Impact (UI / logic / data)
- UI/API: `/playbook/full-flow` now returns `data.ticket_context_appendix` (separate from `ticket_ssot`).
- Logic: `2e` now has a confidence-calibration subphase using historical evidence and updates enrichment confidences before final SSOT persistence.
- Data: New table `ticket_context_appendix` stores JSON appendix payload per ticket.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/playbook.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/db/migrations/013_ticket_context_appendix.sql`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`

# Date
- 2026-02-23
