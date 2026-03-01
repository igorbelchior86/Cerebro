# Context Optional Ticket Metadata Expansion
# What changed
- Added a second expand/collapse control inside the first `Context` card so the customer identity block can reveal optional ticket metadata.
- The expanded sub-section now shows four additional fields: `Priority`, `Issue Type`, `Sub-Issue Type`, and `Service Level Agreement`.
- Reused the existing edit modal so each new field opens a wired dropdown sourced from Autotask ticket field metadata.
- Extended the Autotask UI client and API route surface to expose ticket picklist catalogs and to persist these four fields on existing tickets.

# Why it changed
- These fields are not always critical, but they must be available in the canonical context panel for flows that require them.
- The request explicitly required the same interaction language already used by the main `Context` expand/collapse control, without introducing a separate editing surface.

# Impact (UI / logic / data)
- UI: The first `Context` card now supports a nested disclosure with the same animation pattern (`gridTemplateRows`, fade, and slide) used by the main section toggle.
- Logic: `triage/home` stores the four fields in local draft state, while `triage/[id]` routes selections through the existing ticket context edit flow.
- Data: The API now exposes `ticket-field-options` and the ticket context patch route can update `priority`, `issueType`, `subIssueType`, and `serviceLevelAgreementID`, with refreshed labels persisted into local SSOT metadata.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/PlaybookPanel.tsx`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/lib/p0-ui-client.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/clients/autotask.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/autotask.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`

# Date
- 2026-03-01
