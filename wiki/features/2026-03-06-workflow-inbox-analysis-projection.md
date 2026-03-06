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
- Follow-up hardening: once a sidebar row already carries canonical workflow state, the adapter no longer falls back to PSA ticket status for the main badge; `Done` is gated by A/B/C and only appears when block C is ready.
- Follow-up hardening: for the currently open ticket, the triage page now waits for a checklist that is actually renderable from the playbook markdown before keeping the UI in a completed state.
- Follow-up hardening: advisory validation (`needs_more_info`) no longer dead-ends the pipeline; playbook generation now proceeds whenever validation is still safe, and only hard-blocked cases stop before checklist generation.

# Why it changed
- Cards could appear as `done` only because the upstream ticket status was `resolved/closed/done`, even when the triage analysis had not produced the required content.
- Other cards stayed in `Processing` / `Waiting` because the workflow inbox never learned that the triage artifacts had already been persisted in separate tables.
- This mismatch made the sidebar and the opened ticket detail disagree about whether analysis was complete.
- A remaining gap still allowed `Done` when the playbook contained hypothesis/context markdown but no renderable checklist section.
- A second remaining gap still allowed `Done` because the triage page locally merged old sidebar rows into fresh ones and preserved the old `status` field.
- A third remaining gap still allowed `Done` because the sidebar adapter could still consult the PSA ticket status after reading a canonical inbox row, which violated the canonical flow contract.
- A fourth remaining gap still allowed an apparent early `Done` in the open workspace because the page treated raw `playbook` presence as “ready”, even before the checklist renderer could materialize block C.
- A fifth remaining gap could leave tickets effectively stuck forever before checklist generation because some modules still interpreted advisory validation as a terminal block.

# Impact (UI / logic / data)
- UI:
- Sidebar cards now reflect the workflow pipeline state first, which prevents false `done` badges for tickets with missing analysis blocks.
- Sidebar cards sourced from the canonical inbox now treat `pipeline_status` / `block_consistency` as the only authority for the main badge.
- The currently selected/open ticket is now locally held in `processing` until the playbook markdown yields a renderable checklist, which removes the visual race where `Done` appeared before block C rendered.
- Route handler, background orchestrator, and playbook writer now share the same gating rule for playbook generation: advisory `needs_more_info` may still produce an investigative playbook; only truly unsafe/blocked cases stop.
- Logic:
- `TicketWorkflowCoreService` now exposes `syncAnalysisProjection()` to project triage artifacts into the workflow inbox read model.
- `playbook-route-handlers` and `triage-orchestrator` call that projection after analysis milestones so the inbox and triage session stay aligned.
- `hypothesis_checklist_state` now requires both hypothesis payload and checklist payload.
- Checklist detection now looks only inside `Checklist` / `Resolution Steps` sections and accepts numbered, bullet, and checkbox markdown items.
- The triage page sidebar merge now preserves old ticket labels/details, but not the old workflow badge when fresh workflow state exists.
- The sidebar adapter now returns `completed` only when `core_state`, `network_env_body_state`, and `hypothesis_checklist_state` are all `ready`; otherwise canonical rows stay `pending`, `processing`, or `failed`.
- The triage page now persists and restores `playbookReady` based on renderable checklist readiness, not just `Boolean(playbook)`.
- Playbook generation gates now use `isSafeToGenerate(validation)` instead of ad-hoc checks spread across modules.
- Data:
- No schema migration.
- Workflow inbox `domain_snapshots['correlates.ticket_metadata']` now stores analysis projection markers such as hypotheses, checklist, validation status, and projection timestamps.

# Files touched
- `apps/api/src/services/orchestration/ticket-workflow-core.ts`
- `apps/api/src/services/application/route-handlers/playbook-route-handlers.ts`
- `apps/api/src/services/orchestration/triage-orchestrator.ts`
- `apps/api/src/__tests__/services/ticket-workflow-core.test.ts`
- `apps/web/src/lib/workflow-sidebar-adapter.ts`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `apps/api/src/services/application/route-handlers/playbook-route-handlers.ts`
- `apps/api/src/services/orchestration/triage-orchestrator.ts`
- `apps/api/src/services/ai/playbook-writer.ts`
- `apps/api/src/services/playbook-writer.ts`
- `apps/api/src/__tests__/services/validate-policy-gates.test.ts`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-06
