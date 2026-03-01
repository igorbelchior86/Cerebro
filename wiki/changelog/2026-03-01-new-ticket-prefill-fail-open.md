# New Ticket Prefill Fail Open
# What changed
- Updated `apps/api/src/routes/autotask.ts` so `GET /autotask/ticket-field-options` loads each field catalog independently and degrades to `[]` on per-field failures instead of failing the whole response.
- Updated `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx` so the draft prefill fetches aggregate metadata, draft defaults, and per-field catalogs in parallel, then merges any successful responses.
- Tightened the client-side “loaded” check so `status`, `priority`, and `serviceLevelAgreement` only count as loaded when they contain real options.

# Why it changed
- The previous implementation had a fail-silent path: one runtime error in metadata/default loading could prevent the entire draft from receiving any defaults, leaving the UI empty.
- The user-visible symptom was a fully blank context panel even after backend default logic had already been added.

# Impact (UI / logic / data)
- UI: the New Ticket draft can now populate fields even when one of the metadata/default endpoints fails.
- Logic: draft bootstrap is now partial-success tolerant instead of all-or-nothing.
- Data: no schema changes; this only changes how existing metadata/default responses are consumed and merged.

# Files touched
- `apps/api/src/routes/autotask.ts`
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`
- `wiki/changelog/2026-03-01-new-ticket-prefill-fail-open.md`

# Date
- 2026-03-01
