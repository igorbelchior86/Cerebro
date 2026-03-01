# Draft Ticket Defaults And Mirror Fix
# What changed
- Updated `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/home/page.tsx` so the draft `PlaybookPanel` now re-renders when `Issue Type`, `Sub-Issue Type`, `Priority`, or `Service Level Agreement` change.
- Added draft prefill logic for Autotask-driven ticket metadata using `/autotask/ticket-field-options`: the draft now attempts to auto-fill `status`, `priority`, and `serviceLevelAgreement` from explicit Autotask defaults when available, with deterministic fallback heuristics for `status` (`New`) and `priority` (`P3`/`Medium`/`Normal`).
- Replaced the draft sidebar’s render-time `created_at: new Date().toISOString()` with a stable empty value so the draft row no longer injects a non-deterministic timestamp during initial render.
- Extended Autotask picklist option mapping in `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/clients/autotask.ts` and `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/lib/p0-ui-client.ts` to preserve `isDefault` when the upstream Autotask metadata exposes it.

# Why it changed
- The user-facing draft appeared not to persist metadata edits because the right-side derived view was stale.
- Ticket creation was failing because Autotask requires `priority`, while the Cerebro draft UI only displayed a visual default and did not reliably submit one.
- The draft path needs to mirror Autotask metadata behavior as closely as possible for fields that are auto-loaded from canonical ticket field metadata.

# Impact (UI / logic / data)
- UI: Draft metadata chips/panels now reflect updated Issue/Sub-Issue/Priority/SLA values immediately.
- Logic: Draft create requests now have a much higher chance of including required Autotask defaults for `priority`, and auto-filled SLA when Autotask exposes a single/default choice.
- Data: No schema changes; this only enriches picklist metadata handling and frontend defaulting.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/lib/p0-ui-client.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/clients/autotask.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-03-01
