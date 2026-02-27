# Autotask Phase 1 Full API Capability Matrix (Canonical Freeze)

Date: 2026-02-27
Project: Cerebro (Agent A, Phase 1 contract freeze)
Status: FROZEN (source of truth for Agents B/C/D)

## Scope and policy
- Launch policy unchanged: `autotask=two_way`; `itglue/ninja/sentinelone/checkpoint=read_only`.
- This matrix covers the approved Autotask API-manageable Phase 1 surface only.
- Every operation is explicitly classified as one of:
  - `implemented`
  - `excluded_by_permission`
  - `excluded_by_api_limitation`

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
| tickets | `update_priority` | excluded_by_permission | Stable idempotency key if enabled in future | write_retryable | `autotask.command.policy_rejected` | Not part of current reconcile target set | Out of Phase 1 safe-write scope |
| tickets | `delete` | excluded_by_permission | Hard idempotency token required if ever enabled | non_retryable_terminal | `autotask.command.policy_rejected` | No fail-open deletion allowed | Explicitly blocked |
| ticket_notes | `list_by_ticket` | implemented | N/A (read) | read_retryable | `autotask.read.ticket_notes` | Read notes used for context and reconcile note fingerprint | `GET /tickets/{id}/notes` |
| ticket_notes | `create_comment_note` | implemented | Stable idempotency key per normalized note content + ticket target | write_retryable | `autotask.command.submitted` + `autotask.command.result` | Reconcile must update last note fingerprint expectation | Safe-write command |
| ticket_notes | `update` | excluded_by_api_limitation | Would require deterministic version key | write_retryable | `autotask.command.policy_rejected` | No reconcile contract currently defined | No stable in-repo contract/endpoint usage for note update |
| ticket_checklist_items | `list_by_ticket` | excluded_by_api_limitation | N/A | read_retryable | `autotask.read.checklist_items.skipped` | No checklist signal in current reconcile model | Endpoint/contract not frozen in repo |
| ticket_checklist_items | `create` | excluded_by_api_limitation | Would require checklist-item idempotency key | write_retryable | `autotask.command.policy_rejected` | No checklist mutation reconcile model | Endpoint/contract not frozen in repo |
| ticket_checklist_items | `update` | excluded_by_api_limitation | Would require checklist-item idempotency key | write_retryable | `autotask.command.policy_rejected` | No checklist mutation reconcile model | Endpoint/contract not frozen in repo |
| ticket_checklist_items | `delete` | excluded_by_api_limitation | Would require hard idempotency token | non_retryable_terminal | `autotask.command.policy_rejected` | No checklist mutation reconcile model | Endpoint/contract not frozen in repo |
| time_entries | `create` | implemented | Stable idempotency key required at workflow boundary | write_retryable | `autotask.command.submitted` + `autotask.command.result` | Reconcile expectation: presence in Autotask + local audit link | `POST /timeEntries` supported in client |
| time_entries | `update` | excluded_by_permission | Stable idempotency key if enabled in future | write_retryable | `autotask.command.policy_rejected` | Not in current reconcile model | Out of current safe-write scope |
| time_entries | `delete` | excluded_by_permission | Hard idempotency token required if ever enabled | non_retryable_terminal | `autotask.command.policy_rejected` | Not in current reconcile model | Explicitly blocked |
| contacts | `get_by_id` | implemented | N/A (read) | read_retryable | `autotask.read.contact` | Must enrich requester identity only (read path) | `GET /contacts/{id}` |
| contacts | `query_search` | excluded_by_api_limitation | N/A | read_retryable | `autotask.read.contact_query.skipped` | Not needed by Phase 1 reconcile | No frozen query contract in repo |
| contacts | `create` | excluded_by_permission | Stable idempotency key if enabled in future | write_retryable | `autotask.command.policy_rejected` | No contact write reconcile model | Out of safe-write scope |
| contacts | `update` | excluded_by_permission | Stable idempotency key if enabled in future | write_retryable | `autotask.command.policy_rejected` | No contact write reconcile model | Out of safe-write scope |
| companies | `get_by_id` | implemented | N/A (read) | read_retryable | `autotask.read.company` | Must enrich customer context only (read path) | `GET /companies/{id}` |
| companies | `query_search` | excluded_by_api_limitation | N/A | read_retryable | `autotask.read.company_query.skipped` | Not needed by Phase 1 reconcile | No frozen query contract in repo |
| companies | `create` | excluded_by_permission | Stable idempotency key if enabled in future | write_retryable | `autotask.command.policy_rejected` | No company write reconcile model | Out of safe-write scope |
| companies | `update` | excluded_by_permission | Stable idempotency key if enabled in future | write_retryable | `autotask.command.policy_rejected` | No company write reconcile model | Out of safe-write scope |
| correlates.resources | `get_by_id` | implemented | N/A (read) | read_retryable | `autotask.read.resource` | Supports assignment/context joins | `GET /resources/{id}` |
| correlates.ticket_metadata | `list_queue_options` | implemented | N/A (read) | read_retryable | `autotask.read.ticket_metadata` | Supports assign/status command validation | `GET /tickets/entityInformation/fields` |
| correlates.ticket_metadata | `list_status_options` | implemented | N/A (read) | read_retryable | `autotask.read.ticket_metadata` | Supports reconcile status normalization | `GET /tickets/entityInformation/fields` |
| correlates.ticket_note_metadata | `list_note_type_options` | implemented | N/A (read) | read_retryable | `autotask.read.ticket_note_metadata` | Supports note write payload normalization | `GET /ticketNotes/entityInformation/fields` |

## Explicit exclusion notes
1. `excluded_by_permission`: operation intentionally blocked by current Phase 1 safe-write policy to keep blast radius constrained.
2. `excluded_by_api_limitation`: operation has no frozen endpoint/contract in this repository at this time, so it is not exposed to workflow handlers.
3. No operation remains unclassified.

## Cross-agent contract usage
- Consumer contract source: `packages/types/src/autotask-two-way-contract.ts`
- This document and the typed export must stay in sync. If one changes, both must be updated in the same change set.
