# P0 Graph Projection Worker Spec

## Purpose
Define the first runtime-safe projection contract from the existing Cerebro integration surfaces into the P0 graph layer.

This spec is intentionally constrained to the APIs and client methods already used by the repository today.

## Source policy
- `Autotask`: two-way in product policy, but graph projection reads snapshots only.
- `NinjaOne`: read-only.
- `IT Glue`: read-only.
- Graph projection must never create new writes against external integrations.

## Documentation basis
- Autotask REST auth / zone discovery:
  - `https://webservices.autotask.net/help/developerhelp/Content/APIs/REST/General_Topics/REST_API_Authentication.htm`
  - `https://ww16.autotask.net/help/developerhelp/Content/APIs/REST/General_Topics/REST_API_Discovering_Your_Zone_Resource_URL.htm`
- NinjaOne API docs:
  - `https://app.ninjarmm.com/apidocs`
  - `https://app.ninjarmm.com/apidocs-beta/core-resources/operations/oauthToken`
- IT Glue API docs:
  - `https://api.itglue.com/developer`

Repository alignment:
- `apps/api/src/clients/autotask.ts`
- `apps/api/src/clients/ninjaone.ts`
- `apps/api/src/clients/itglue.ts`
- `docs/contracts/autotask-phase1-full-api-capability-matrix.md`

## Projection input
Projection is triggered from:
- latest persisted SSOT snapshot
- latest Autotask canonical ticket snapshot
- relevant enrichment deltas already gathered in `PrepareContext`

Projection must carry:
- `tenant_id`
- `ticket_id`
- `ssot_version`
- `trace_id`
- `projection_version`

## Entity mapping by source

### Autotask
Available client methods already in repo:
- `getTicket`
- `getTicketByTicketNumber`
- `searchTickets`
- `getCompany`
- `getContact`
- `getResource`
- `getDevice` (`configurationItems`)

Graph mapping:
- `Ticket`
  - source: `tickets`
  - key: `tenant_id:ticket:{ticketNumber || id}`
  - fields: `ticket_id`, `source_ref`, `status`, `queue_id`, `created_at`, `title`
- `Organization`
  - source: `companies`
  - key: `tenant_id:org:autotask:{company.id}`
  - fields: `canonical_org_key`, `org_name`, `source_ref`
- `Person`
  - source: `contacts`
  - key: `tenant_id:person:{normalized_email || autotask_contact_id}`
  - fields: `canonical_user_key`, `email`, `display_name`
- `UserAccount`
  - source: `resources`
  - key: `tenant_id:useraccount:autotask:{resource.id}`
  - fields: `canonical_user_key`, `upn`, `account_status`
- `Device`
  - source: `configurationItems`
  - key: `tenant_id:device:{referenceTitle || serialNumber || id}`
  - fields: `canonical_device_key`, `device_name`, `os_name`, `source_ref`
- `IntegrationEvent`
  - source: Autotask poller/webhook/reconcile metadata already captured locally
  - key: `tenant_id:event:{event_id}`
  - fields: `event_key`, `source_system`, `event_type`, `observed_at`

Relationships seeded from Autotask:
- `(:Ticket)-[:REQUESTED_BY]->(:Person)`
- `(:Ticket)-[:AFFECTS]->(:Device)` when configuration item is available
- `(:Device)-[:BELONGS_TO_ORG]->(:Organization)`
- `(:Ticket)-[:HAS_EVENT]->(:IntegrationEvent)`

### NinjaOne
Available client methods already in repo:
- `getDevice`
- `listDevices`
- `listDevicesByOrganization`
- `getDeviceChecks`
- `getDeviceDetails`
- `getDeviceLastLoggedOnUser`
- `getDeviceActivities`
- `getDeviceNetworkInterfaces`

Graph mapping:
- `Device`
  - key: `tenant_id:device:{ninja_device_id}`
  - fields: `canonical_device_key`, `device_name`, `os_name`, `os_version`, `last_check_in`
- `UserAccount`
  - key: `tenant_id:useraccount:{normalized_userName}`
  - fields: `canonical_user_key`, `upn`
- `Alert`
  - derived from checks and/or activities, not from a writeback surface
  - key: `tenant_id:alert:ninja:{deviceId}:{checkId|activityId}`
  - fields: `alert_key`, `severity`, `alert_type`, `observed_at`
- `IntegrationEvent`
  - optional mirror of significant activity events
  - key: `tenant_id:event:ninja:{deviceId}:{activityId}`

Relationships seeded from NinjaOne:
- `(:UserAccount)-[:LOGGED_IN_ON]->(:Device)`
- `(:Alert)-[:OBSERVED_IN_ALERT]->(:Device)`

Projection rule:
- use `getDeviceLastLoggedOnUser` as the strongest identity signal for `LOGGED_IN_ON`
- use checks first for deterministic alert facts; activities are secondary context

### IT Glue
Available client methods already in repo:
- `getOrganizations`
- `getOrganizationById`
- `getConfigurations`
- `getContacts`
- `getPasswords`
- `getLocations`
- `getDomains`
- `getOrganizationDocuments`
- `searchDocuments`

Graph mapping:
- `Organization`
  - key: `tenant_id:org:itglue:{organization.id}`
  - fields: `canonical_org_key`, `org_name`, `source_ref`
- `Device`
  - source: `configurations`
  - key: `tenant_id:device:{hostname || name || configuration.id}`
  - fields: `canonical_device_key`, `device_name`, `os_name`
- `Person`
  - source: `contacts`
  - key: `tenant_id:person:{primary_email || contact.id}`
  - fields: `canonical_user_key`, `email`, `display_name`
- `Software`
  - source: software-like references extracted from configuration attributes and documents
  - key: `tenant_id:software:{normalized_name[:version]}`
  - fields: `software_key`, `name`, `version`

Relationships seeded from IT Glue:
- `(:Device)-[:BELONGS_TO_ORG]->(:Organization)`
- `(:Ticket)-[:MENTIONS_SOFTWARE]->(:Software)` only when software evidence is already grounded in cached IT Glue material

Projection rule:
- treat IT Glue as documentation/configuration evidence only
- do not infer alerts from IT Glue

## Cross-source identity resolution
- `canonical_org_key`
  - priority: Autotask company id -> matched IT Glue organization id -> normalized organization name fallback
- `canonical_user_key`
  - priority: normalized email -> normalized UPN -> source-local id fallback
- `canonical_device_key`
  - priority: normalized hostname -> serial/reference identifier -> source-local device id fallback

Projection must preserve `source_ref` on every node so merges remain auditable.

## Projection execution order
1. Upsert `Tenant`.
2. Upsert `Ticket` from SSOT + Autotask canonical snapshot.
3. Upsert `Organization`, `Person`, `UserAccount`, `Device`.
4. Upsert `Alert` and `IntegrationEvent`.
5. Create/update relationships with `MERGE`.
6. Run deterministic hint query pack.
7. Persist normalized `graph_hints` back into the local appendices only.

## Write semantics
- All node writes use deterministic `graph_key`.
- All relationship writes use `MERGE` on endpoint pair + relationship type.
- On match, update mutable ranking fields only.
- No delete of nodes/edges in normal P0 flow.
- Cleanup is allowed only in explicit replay/rebuild jobs scoped by `tenant_id`.

## Failure handling
- If any source fetch is unavailable, projection proceeds with partial evidence.
- If graph write fails, record a local failed projection artifact with:
  - `tenant_id`
  - `ticket_id`
  - `ssot_version`
  - `trace_id`
  - `retry_count`
  - `failed_stage`
- Standard `PrepareContext` output must continue without graph hints.

## First implementation targets
- Runtime worker module:
  - suggested path: `apps/api/src/services/graph-projection-worker.ts`
- Cypher bootstrap:
  - `docs/graph/p0/schema_init.cypher`
- Cypher query seeds:
  - `docs/graph/p0/query_templates.cypher`
