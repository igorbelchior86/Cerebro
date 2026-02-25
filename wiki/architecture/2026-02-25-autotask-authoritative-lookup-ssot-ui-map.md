# Autotask authoritative lookup to SSOT to UI map
# What changed
Documented the canonical mapping from Autotask ticket-derived lookups (`Companies`, `Contacts`, `Resources`) into `ticket_ssot.autotask_authoritative` and the UI/API consumption points in Cerebro.

Includes the implementation rule: identifiers and display values derived deterministically from Autotask IDs should be promoted to SSOT and consumed before heuristic/inferred values.

# Why it changed
After moving to an Autotask-first pipeline, some UI fields still showed `unknown` because only IDs (e.g. `company_id`) were persisted, while display labels (e.g. organization/company name) were still relying on inference.

# Impact (UI / logic / data)
- UI: clarifies which blocks should consume canonical Autotask-derived fields first.
- Logic: standardizes `ticket -> lookup -> SSOT -> API/UI` order before cross-source inference.
- Data: establishes authoritative field naming inside `ticket_ssot.payload.autotask_authoritative`.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/wiki/architecture/2026-02-25-autotask-authoritative-lookup-ssot-ui-map.md`

# Date
2026-02-25

## Mapping Table (Autotask lookup -> SSOT -> UI)

| Lookup (Autotask) | Trigger field from `Tickets` | Promote to SSOT (`autotask_authoritative`) | Also sync to SSOT canonical fields | UI/API consumers (current) |
|---|---|---|---|---|
| `Companies/{companyID}` | `companyID` | `company_id`, `company_name` | `ticket_ssot.company` | Sidebar list `/email-ingestion/list` (`company/org`), triage detail header/context via `ssot.company`, `/playbook/full-flow` `data.ticket.company` |
| `Contacts/{contactID}` | `contactID` | `contact_id`, `contact_name`, `contact_email` | `ticket_ssot.requester_name`, `ticket_ssot.requester_email` | Sidebar list requester label, triage detail requester/user fallbacks, `/playbook/full-flow` `data.ticket.requester(_normalized)` |
| `Resources/{assignedResourceID}` | `assignedResourceID` | `assigned_resource_id`, `assigned_resource_name`, `assigned_resource_email` | (none yet; retained as authoritative metadata) | Exposed via `/playbook/full-flow` canonical ticket payload for future UI use |
| `Tickets` (base) | poller/search result | `ticket_number`, `ticket_id_numeric`, `title`, `description` | `ticket_ssot.ticket_id`, `ticket_ssot.title` (and `description_clean` kept normalized separately) | Triage header/title, timeline request message, sidebar ID/title |

## Implementation Rule (deterministic)
1. Read `Tickets`.
2. Resolve deterministic related entities via IDs (`Companies`, `Contacts`, `Resources`).
3. Persist identifiers + display values in `ticket_ssot.autotask_authoritative`.
4. Mirror display-critical values into top-level SSOT fields used by UI (`company`, `requester_name`, `requester_email`).
5. Only then allow heuristic/cross-source inference to fill remaining gaps.
