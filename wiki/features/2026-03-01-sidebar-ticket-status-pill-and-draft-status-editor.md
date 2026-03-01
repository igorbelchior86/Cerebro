# Sidebar Ticket Status Pill And Draft Status Editor
# What changed
- Added real Autotask ticket status metadata to the sidebar ticket data path so cards can render the actual ticket status separately from the existing workflow-state badge.
- Added a new status pill below the timestamp in the left sidebar cards, with an inline pencil action that opens a status picker backed by Autotask status options.
- Added a live draft ticket card to the `New Ticket` flow sidebar. The draft card auto-populates from the local draft state and defaults its status pill to `New`.
- Wired draft status edits to local draft state and wired existing-ticket status edits to the audited `workflow/commands` path using `command_type: update_status`.
- Extended the Autotask ticket field options endpoint to expose `status` options.

# Why it changed
- The left sidebar had an empty slot below the timestamp that needed to surface the real ticket status.
- The `New Ticket` experience needed to behave more like an Autotask skin, showing a live draft card with an immediately visible default status.
- Technicians need to edit ticket status directly from the sidebar for both draft and existing tickets.

# Impact (UI / logic / data)
- UI:
  - Sidebar cards now show a real ticket status pill in the lower-left metadata slot.
  - Draft mode now shows a synthetic sidebar card that updates as the draft changes.
  - Both real tickets and the draft card expose a pencil-triggered status picker modal.
- Logic:
  - Sidebar status display now resolves from explicit labels first, then from Autotask status IDs via cached picklist metadata.
  - Draft status preloads from Autotask status options, preferring a `New` label when available.
  - Existing-ticket status changes execute via workflow command polling and apply a local override after command completion.
- Data:
  - `/autotask/ticket-field-options` now returns `status` picklist metadata.
  - Sidebar ticket payloads now preserve raw Autotask status values for label resolution.
  - Workflow inbox rows can now pass through domain snapshot data used for status label hydration.

# Files touched
- `apps/api/src/routes/autotask.ts`
- `apps/web/src/lib/p0-ui-client.ts`
- `apps/web/src/lib/workflow-sidebar-adapter.ts`
- `apps/web/src/components/ChatSidebar.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `tasks/todo.md`

# Date
- 2026-03-01
