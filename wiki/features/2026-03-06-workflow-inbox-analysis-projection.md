# Workflow inbox analysis projection
# What changed
- Stopped using the ticket's textual status as the main source for the sidebar card state when workflow pipeline data is present.
- Added a workflow projection path that copies triage analysis progress back into the workflow inbox read model.
- The full-flow route now projects existing and newly generated `pack`, `diagnosis`, `validation`, and `playbook` artifacts into the inbox.
- The background triage orchestrator now projects the same analysis milestones into the inbox while the pipeline runs outside the request path.
- The inbox projection now stores enough metadata to mark `context`, `hypotheses`, and `checklist` as ready once they were actually generated.
- Follow-up hardening: `Done` now requires a real checklist, not just hypothesis text.
- Follow-up hardening: markdown checklist detection is now aligned between backend projection and frontend rendering.
- Follow-up hardening: sidebar merge logic no longer reuses an old card status when the fresh payload already carries workflow state.

# Why it changed
- Cards could appear as `done` only because the upstream ticket status was `resolved/closed/done`, even when the triage analysis had not produced the required content.
- Other cards stayed in `Processing` / `Waiting` because the workflow inbox never learned that the triage artifacts had already been persisted in separate tables.
- This mismatch made the sidebar and the opened ticket detail disagree about whether analysis was complete.
- A remaining gap still allowed `Done` when the playbook contained hypothesis/context markdown but no renderable checklist section.
- A second remaining gap still allowed `Done` because the triage page locally merged old sidebar rows into fresh ones and preserved the old `status` field.

# Impact (UI / logic / data)
- UI:
- Sidebar cards now reflect the workflow pipeline state first, which prevents false `done` badges for tickets with missing analysis blocks.
- Logic:
- `TicketWorkflowCoreService` now exposes `syncAnalysisProjection()` to project triage artifacts into the workflow inbox read model.
- `playbook-route-handlers` and `triage-orchestrator` call that projection after analysis milestones so the inbox and triage session stay aligned.
- `hypothesis_checklist_state` now requires both hypothesis payload and checklist payload.
- Checklist detection now looks only inside `Checklist` / `Resolution Steps` sections and accepts numbered, bullet, and checkbox markdown items.
- The triage page sidebar merge now preserves old ticket labels/details, but not the old workflow badge when fresh workflow state exists.
- Data:
- No schema migration.
- Workflow inbox `domain_snapshots['correlates.ticket_metadata']` now stores analysis projection markers such as hypotheses, checklist, validation status, and projection timestamps.

# Files touched
- `apps/api/src/services/orchestration/ticket-workflow-core.ts`
- `apps/api/src/services/application/route-handlers/playbook-route-handlers.ts`
- `apps/api/src/services/orchestration/triage-orchestrator.ts`
- `apps/api/src/__tests__/services/ticket-workflow-core.test.ts`
- `apps/web/src/lib/workflow-sidebar-adapter.ts`
- `tasks/todo.md`

# Date
- 2026-03-06
