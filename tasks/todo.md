# Task: Playbook stopped generating after iterative PrepareContext
**Status**: completed
**Started**: 2026-02-20

## Plan
- [x] Step 1: Reproduce and identify failing stage in full flow.
- [x] Step 2: Pinpoint root cause in backend code and data contracts.
- [x] Step 3: Implement minimal root-cause fix.
- [x] Step 4: Verify end-to-end generation path can resume.
- [x] Step 5: Update wiki/docs and lessons.

## Open Questions
- LLM provider keys in local shell scripts may differ from API service env; runtime generation should be verified through app UI flow.

## Progress Notes
- Root cause found in logs: `PrepareContext` query failed with `column "company" does not exist`, causing no evidence pack and therefore no playbook.
- Added schema-compatible handling in `PrepareContext` (company column detection + projection fallback).
- Added schema-compatible handling in `PgStore.saveProcessedTicket` so new email tickets are persisted even if `company` column is absent.
- Added stale `processing` session recovery in orchestrator (resume if stuck > 5min).

## Review
- What worked:
  - Eliminated blocker that prevented evidence generation for newer tickets.
  - Added resilience against schema drift and stuck sessions.
- What was tricky:
  - Distinguish runtime service env vs ad-hoc shell env for LLM provider checks.
- Time taken:
  - ~20 minutes
