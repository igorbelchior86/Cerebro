# Full-flow 304 handling + workflow inbox hydration hardening
# What changed
- Fixed triage full-flow polling to accept HTTP `304` without transitioning UI into error/fallback state.
- Expanded workflow inbox hydration to fill not only `company/requester`, but also `status`, `assigned_to`, `queue_id`, and `queue_name`.
- Added alias support during hydration and sidebar mapping for requester fields (`requester_name`, `contact_name`, `requester`) and status/queue/assignee snapshot fields.
- Hardened `playbook/full-flow` authoritative overlay to normalize Autotask field aliases and enrich labels for `status`, `priority`, `issue_type`, `sub_issue_type`, and `SLA`.
- Corrected full-flow note retrieval to resolve ticket numeric id from `id`/`ticketID`/`ticketId` before calling `getTicketNotes`.
- Added timeline fallback to include `ticket.updates` when notes exist outside canonical note entities.
- Extended prepare-context SSOT authoritative seed with `secondary_resource`, `status`, `priority`, `issue_type`, `sub_issue_type`, and `service_level_agreement` ids.
- Fixed full-flow reviewer credential resolution to use request tenant (`req.auth.tid`) explicitly, avoiding silent no-tenant overlay/notes gaps.
- Synced active left-sidebar ticket card with canonical full-flow snapshot (`org/requester/status`) to prevent persistent Unknown values on selected ticket.
- Restored safe fallbacks for `priority/issue/sub-issue/sla/status` in canonical ticket assembly when authoritative overlay is temporarily unavailable.
- Fixed frontend race condition in triage page where sidebar polling replaced enriched ticket cards with degraded payloads (`Unknown/Unassigned`), causing visible flip-flop.
- Added deterministic merge strategy for sidebar ticket state, preferring known values over placeholder fallbacks.
- Fixed status oscillation where event-like labels (e.g. `Customer note added`) were incorrectly promoted to canonical ticket status in the sidebar card.
- Added regression test to guarantee sparse inbox rows are completed from snapshot aliases without forcing remote fetch.

# Why it changed
- Investigation showed tickets staying in fallback/unknown state even with `200` responses because:
- `304` responses from `/playbook/full-flow` were treated as Axios errors in polling.
- Inbox hydration logic was too narrow and left key fields empty when data existed in alternate snapshot keys.
- Authoritative Autotask fields were partially mapped (missing alias variants/labels), causing right-panel context gaps and priority mismatch.
- Ticket note fetch could return empty feed when Autotask response used `ticketID` instead of `id`.
- Reviewer overlay/notes could silently skip when tenant context was not propagated into helper resolution.
- Sidebar card oscillation was caused by concurrent state writers (10s inbox poll replacing 3s enriched state).
- Status field was also contaminated by semantic mismatch: activity/event labels were treated as lifecycle status labels.

# Impact (UI / logic / data)
- UI:
- Triage page no longer flips to error state on `304` full-flow responses.
- Sidebar cards now display org/requester/status/queue/assignee with stronger fallback resolution from snapshots.
- Right context panel now has stronger chance to show Issue Type/Sub-Issue Type/Priority/SLA from authoritative overlay labels.
- Center timeline now includes richer historical entries via fixed Autotask note id resolution + `ticket.updates` fallback.
- Center timeline now also benefits from deterministic tenant-scoped reviewer resolution.
- Logic:
- Inbox hydration batch now upgrades sparse tickets across more canonical fields.
- Full-flow overlay now performs broader key normalization across Autotask payload variants.
- Canonical ticket assembly now keeps non-empty fallback values for context fields when overlay is temporarily unavailable.
- Sidebar state merge now prevents degraded overwrite races for selected and non-selected tickets.
- Sidebar status merge now accepts only lifecycle-like labels and rejects note/comment event labels from overriding canonical status.
- Data:
- No schema migration. Existing inbox rows are progressively enriched on list/hydration cycle.
- No schema migration. Existing SSOT rows can be incrementally improved by next context preparation/refresh.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `apps/web/src/lib/workflow-sidebar-adapter.ts`
- `apps/api/src/services/orchestration/ticket-workflow-core.ts`
- `apps/api/src/services/application/route-handlers/playbook-route-handlers.ts`
- `apps/api/src/services/context/prepare-context.ts`
- `apps/api/src/services/context/prepare-context.types.ts`
- `apps/api/src/__tests__/services/ticket-workflow-core.test.ts`
- `tasks/todo.md`

# Date
- 2026-03-03
