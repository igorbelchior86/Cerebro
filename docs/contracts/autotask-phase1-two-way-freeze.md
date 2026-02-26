# Autotask Phase 1 Two-way Contract Freeze

Date: 2026-02-26  
Project: Cerebro (Phase 1: Autotask Two-way Happy Path E2E)

## Source of truth
Primary source is official Autotask REST API docs:
- Authentication: https://webservices.autotask.net/help/developerhelp/Content/APIs/REST/General_Topics/REST_API_Authentication.htm
- Ticket entity URLs/methods (`/Tickets`, `/Tickets/query`, `/Tickets/{id}`): https://webservices.autotask.net/help/developerhelp/Content/APIs/REST/Entities/TicketsEntity.htm
- Ticket Notes child resource (`/Tickets/{parentId}/Notes`): https://webservices.autotask.net/help/developerhelp/Content/APIs/REST/Entities/TicketNotesEntity.htm

Context7 was queried first for an Autotask library ID and returned no matching Autotask REST library, so the freeze uses official vendor docs directly.

## 1) Minimum two-way command contract (frozen)
Typed contract is frozen in:
- `packages/types/src/autotask-two-way-contract.ts`

Allowed minimum commands:
- `assign`
- `status_update`
- `comment_note`

## 2) Endpoint mapping
| Command | Endpoint | Method | Required fields | Idempotency strategy | Retry policy | Error classification |
|---|---|---|---|---|---|---|
| assign | `/tickets` | `PATCH` | `id`, `assignedResourceID` | Stable `idempotency_key` per logical assignment mutation; payload hash guard | Exponential backoff + jitter, max 5 attempts (1s to 60s) | Retryable: `429`, `5xx`, network timeout/reset. Terminal: `400`, `401`, `403`, `404` |
| status_update | `/tickets` | `PATCH` | `id`, `status` | Stable `idempotency_key` per logical status transition; payload hash guard | Exponential backoff + jitter, max 5 attempts (1s to 60s) | Retryable: `429`, `5xx`, network timeout/reset. Terminal: `400`, `401`, `403`, `404` |
| comment_note | `/tickets/{id}/notes` | `POST` | `title`, `description`, `noteType`, `publish` | Stable `idempotency_key` per target ticket + normalized note body | Exponential backoff + jitter, max 5 attempts (1s to 60s) | Retryable: `429`, `5xx`, network timeout/reset. Terminal: `400`, `401`, `403`, `404` |

Notes:
- Command field names above are frozen Cerebro contract fields and map to Autotask API fields at adapter boundary.
- `comment_note` keeps explicit visibility/type fields (`publish`, `noteType`) to avoid implicit behavior drift.

## 3) Reconciliation model (frozen)
Comparison surface (Cerebro vs Autotask):
- `assigned_resource_id`
- `status`
- `last_note_fingerprint`
- `updated_at`

Mismatch classes:
- `missing_in_autotask`
- `missing_in_cerebro`
- `value_mismatch`
- `stale_sync`
- `duplicate_command_effect`

Remediation actions:
- Retry sync and run reconcile again
- Enqueue compensating command when policy allows
- Escalate to HITL/manual review
- Raise operational alert with `tenant_id/ticket_id/trace_id/command_id`

## 4) Audit model (required fields)
Mandatory fields for every write attempt:
- `tenant_id`
- `ticket_id`
- `command_id`
- `trace_id`
- `result`
- `reason`

`result` values are frozen as:
- `success`
- `retry_pending`
- `terminal_failure`
- `policy_rejected`

## 5) Safe write scope (explicitly allowed now)
Allowed now:
- `assign`
- `status_update`
- `comment_note`

Explicitly out of scope in Phase 1:
- Create/delete ticket
- Time entry writes
- Queue re-parenting beyond assignment path
- Priority/contact/company mutations
- Any write on integrations other than Autotask

Launch policy remains unchanged:
- `autotask = two_way`
- `itglue = read_only`
- `ninja = read_only`
- `sentinelone = read_only`
- `checkpoint = read_only`
