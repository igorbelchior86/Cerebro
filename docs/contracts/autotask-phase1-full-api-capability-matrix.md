# Autotask Phase 1 Full API Capability Matrix (Canonical Freeze)

Date: 2026-02-27
Project: Cerebro (Agent A, Phase 1 contract freeze)
Status: FROZEN (source of truth for Agents B/C/D)

## Scope and policy
- Launch policy unchanged: `autotask=two_way`; `itglue/ninja/sentinelone/checkpoint=read_only`.
- This matrix covers the approved Autotask API-manageable Phase 1 surface only.
- Every operation is explicitly classified as `implemented`.

## Documentation basis
- Context7 query executed first; available result was a community wrapper (`/kelvintegelaar/autotaskapi`) and did not provide full official entity-level coverage for this freeze.
- Fallback basis (authoritative for this repository freeze): existing Cerebro frozen contracts + current adapter/client implementation + existing internal freeze docs.

## Canonical capability matrix
| Domain | Operation | Status | Idempotency requirement | Retry class | Audit events | Sync/reconcile expectation | Notes |
|---|---|---|---|---|---|---|---|
| tickets | `get_by_id` | implemented | N/A (read) | read_retryable | `autotask.read.ticket` | Must hydrate canonical ticket snapshot | `GET /tickets/{id}` via client |
| tickets | `get_by_ticket_number` | implemented | N/A (read) | read_retryable | `autotask.read.ticket` | Must resolve to Autotask entity `id` for write paths | Implemented through `/tickets/query` |
| tickets | `query_search` | implemented | N/A (read) | read_retryable | `autotask.read.ticket_query` | Must support polling and intake discovery | `/tickets/query` |
| tickets | `create` | implemented | Idempotency key required at workflow boundary | write_retryable | `autotask.command.submitted` + `autotask.command.result` | Sync must ingest resulting ticket state | `POST /tickets` supported in client |
| tickets | `update_assign` | implemented | Stable idempotency key per logical mutation + payload hash guard | write_retryable | `autotask.command.submitted` + `autotask.command.result` | Reconcile must compare assigned resource | Safe-write command |
| tickets | `update_status` | implemented | Stable idempotency key per logical mutation + payload hash guard | write_retryable | `autotask.command.submitted` + `autotask.command.result` | Reconcile must compare status code/label equivalence | Safe-write command |
| tickets | `update_priority` | implemented | Stable idempotency key + payload hash guard per logical priority mutation | write_retryable | `autotask.command.submitted` + `autotask.command.result` | Priority mutation must be auditable and replay-safe | `PATCH /tickets` |
| tickets | `delete` | implemented | Hard idempotency token required | non_retryable_terminal | `autotask.command.submitted` + `autotask.command.result` | Delete requires explicit approval token + terminal audit outcome | `DELETE /tickets/{id}` |
| ticket_notes | `list_by_ticket` | implemented | N/A (read) | read_retryable | `autotask.read.ticket_notes` | Read notes used for context and reconcile note fingerprint | `GET /tickets/{id}/notes` |
| ticket_notes | `create_comment_note` | implemented | Stable idempotency key per normalized note content + ticket target | write_retryable | `autotask.command.submitted` + `autotask.command.result` | Reconcile must update last note fingerprint expectation | Safe-write command |
| ticket_notes | `update` | implemented | Stable idempotency key + note_id + payload hash guard | write_retryable | `autotask.command.submitted` + `autotask.command.result` | Updated note content must remain auditable | `PATCH /tickets/{id}/notes` |
| ticket_checklist_items | `list_by_ticket` | implemented | N/A | read_retryable | `autotask.read.checklist_items` | Checklist snapshot can be consumed by engine/context flows | `GET /tickets/{id}/checklistItems` |
| ticket_checklist_items | `create` | implemented | Checklist-item idempotency key required | write_retryable | `autotask.command.submitted` + `autotask.command.result` | Checklist create must be replay-safe | `POST /tickets/{id}/checklistItems` |
| ticket_checklist_items | `update` | implemented | Checklist-item idempotency key required | write_retryable | `autotask.command.submitted` + `autotask.command.result` | Checklist update must be replay-safe | `PATCH /tickets/{id}/checklistItems` |
| ticket_checklist_items | `delete` | implemented | Hard idempotency token required | non_retryable_terminal | `autotask.command.submitted` + `autotask.command.result` | Checklist delete requires explicit approval token | `DELETE /tickets/{id}/checklistItems/{checklistItemId}` |
| time_entries | `create` | implemented | Stable idempotency key required at workflow boundary | write_retryable | `autotask.command.submitted` + `autotask.command.result` | Reconcile expectation: presence in Autotask + local audit link | `POST /timeEntries` supported in client |
| time_entries | `update` | implemented | Stable idempotency key + payload hash guard per update | write_retryable | `autotask.command.submitted` + `autotask.command.result` | Time-entry update must be replay-safe | `PATCH /timeEntries` |
| time_entries | `delete` | implemented | Hard idempotency token required | non_retryable_terminal | `autotask.command.submitted` + `autotask.command.result` | Time-entry delete requires explicit approval token | `DELETE /timeEntries/{id}` |
| contacts | `get_by_id` | implemented | N/A (read) | read_retryable | `autotask.read.contact` | Must enrich requester identity only (read path) | `GET /contacts/{id}` |
| contacts | `query_search` | implemented | N/A | read_retryable | `autotask.read.contact_query` | Supports contact search workflows | `GET /contacts/query` |
| contacts | `create` | implemented | Stable idempotency key + payload hash guard per create | write_retryable | `autotask.command.submitted` + `autotask.command.result` | Contact create must be replay-safe | `POST /contacts` |
| contacts | `update` | implemented | Stable idempotency key + payload hash guard per update | write_retryable | `autotask.command.submitted` + `autotask.command.result` | Contact update must be replay-safe | `PATCH /contacts` |
| companies | `get_by_id` | implemented | N/A (read) | read_retryable | `autotask.read.company` | Must enrich customer context only (read path) | `GET /companies/{id}` |
| companies | `query_search` | implemented | N/A | read_retryable | `autotask.read.company_query` | Supports company search workflows | `GET /companies/query` |
| companies | `create` | implemented | Stable idempotency key + payload hash guard per create | write_retryable | `autotask.command.submitted` + `autotask.command.result` | Company create must be replay-safe | `POST /companies` |
| companies | `update` | implemented | Stable idempotency key + payload hash guard per update | write_retryable | `autotask.command.submitted` + `autotask.command.result` | Company update must be replay-safe | `PATCH /companies` |
| correlates.resources | `get_by_id` | implemented | N/A (read) | read_retryable | `autotask.read.resource` | Supports assignment/context joins | `GET /resources/{id}` |
| correlates.ticket_metadata | `list_queue_options` | implemented | N/A (read) | read_retryable | `autotask.read.ticket_metadata` | Supports assign/status command validation | `GET /tickets/entityInformation/fields` |
| correlates.ticket_metadata | `list_status_options` | implemented | N/A (read) | read_retryable | `autotask.read.ticket_metadata` | Supports reconcile status normalization | `GET /tickets/entityInformation/fields` |
| correlates.ticket_note_metadata | `list_note_type_options` | implemented | N/A (read) | read_retryable | `autotask.read.ticket_note_metadata` | Supports note write payload normalization | `GET /ticketNotes/entityInformation/fields` |

## Explicit exclusion notes
1. All Wave 0 `excluded_*` rows are implemented in Wave B runtime.
2. No operation remains excluded for implementation reasons.
3. No operation remains unclassified.

## Cross-agent contract usage
- Consumer contract source: `packages/types/src/autotask-two-way-contract.ts`
- This document and the typed export must stay in sync. If one changes, both must be updated in the same change set.

## Wave 0 exclusion burn-down plan (implementation-ready)
| Row (`domain.operation`) | Required endpoint(s) | Required payload / validation | Target module | Test required |
|---|---|---|---|---|
| `tickets.update_priority` | `PATCH /tickets` | `id`, `priority`; validate numeric IDs, immutable ticket identity in request scope | `apps/api/src/services/ticket-workflow-core.ts` + `apps/api/src/clients/autotask.ts` | workflow command contract + client payload mapping |
| `tickets.delete` | `DELETE /tickets/{id}` | `ticket_id`; require hard idempotency token + destructive approval gate | `apps/api/src/services/ticket-workflow-core.ts` + `apps/api/src/routes/workflow.ts` | policy gate rejection/approval + destructive audit trail |
| `ticket_notes.update` | `PATCH /tickets/{id}/notes` | `ticket_id`, `note_id`, one or more mutable note fields; require optimistic-concurrency token if available | `apps/api/src/services/ticket-workflow-core.ts` + `apps/api/src/clients/autotask.ts` | note update command schema + replay/idempotency test |
| `ticket_checklist_items.list_by_ticket` | `GET /tickets/{id}/checklistItems` | `ticket_id`; validate positive ticket id | `apps/api/src/clients/autotask.ts` + `apps/api/src/services/prepare-context.ts` | checklist query parsing contract |
| `ticket_checklist_items.create` | `POST /tickets/{id}/checklistItems` | `ticket_id`, `title`, optional `is_completed`; require idempotency key | `apps/api/src/services/ticket-workflow-core.ts` + `apps/api/src/clients/autotask.ts` | create checklist command schema |
| `ticket_checklist_items.update` | `PATCH /tickets/{id}/checklistItems` | `ticket_id`, `checklist_item_id`, mutable fields; require idempotency key | `apps/api/src/services/ticket-workflow-core.ts` + `apps/api/src/clients/autotask.ts` | update checklist command schema |
| `ticket_checklist_items.delete` | `DELETE /tickets/{id}/checklistItems/{checklistItemId}` | `ticket_id`, `checklist_item_id`; destructive token required | `apps/api/src/services/ticket-workflow-core.ts` + `apps/api/src/routes/workflow.ts` | delete checklist policy + audit test |
| `time_entries.update` | `PATCH /timeEntries` | `id` + mutable time-entry fields; validate work-date/hours bounds | `apps/api/src/services/ticket-workflow-core.ts` + `apps/api/src/clients/autotask.ts` | time-entry update command schema |
| `time_entries.delete` | `DELETE /timeEntries/{id}` | `time_entry_id`; destructive token required | `apps/api/src/services/ticket-workflow-core.ts` + `apps/api/src/routes/workflow.ts` | time-entry delete policy + audit test |
| `contacts.query_search` | `GET /contacts/query` | structured filter with allowed ops; enforce tenant-scoped correlation context | `apps/api/src/clients/autotask.ts` + `apps/api/src/services/prepare-context.ts` | contact query request/response schema |
| `contacts.create` | `POST /contacts` | minimum contact payload (`companyID`, name/email); required idempotency key | `apps/api/src/services/ticket-workflow-core.ts` + `apps/api/src/clients/autotask.ts` | contact create command schema |
| `contacts.update` | `PATCH /contacts` | `id` + mutable fields; idempotency key + payload hash guard | `apps/api/src/services/ticket-workflow-core.ts` + `apps/api/src/clients/autotask.ts` | contact update command schema |
| `companies.query_search` | `GET /companies/query` | structured filter with allowed ops; bounded page size | `apps/api/src/clients/autotask.ts` + `apps/api/src/services/prepare-context.ts` | company query request/response schema |
| `companies.create` | `POST /companies` | minimum company payload (`companyName`, active flag); required idempotency key | `apps/api/src/services/ticket-workflow-core.ts` + `apps/api/src/clients/autotask.ts` | company create command schema |
| `companies.update` | `PATCH /companies` | `id` + mutable fields; idempotency key + payload hash guard | `apps/api/src/services/ticket-workflow-core.ts` + `apps/api/src/clients/autotask.ts` | company update command schema |

Wave 0 output rule:
- Every row above has a concrete contract/type schema in `packages/types/src/autotask-two-way-contract.ts`.
- Runtime implementation remains out-of-scope for this wave (B/C).
