// Cerebro P0-GRAPH Schema Init
// Purpose: first-pass tenant-scoped schema for graph projection.
// Status: implementation seed; not yet wired into runtime bootstrap.

// Node identity via deterministic graph_key = tenant_id:type:canonical_key
CREATE CONSTRAINT graph_tenant_key IF NOT EXISTS
FOR (n:Tenant) REQUIRE n.graph_key IS UNIQUE;

CREATE CONSTRAINT graph_ticket_key IF NOT EXISTS
FOR (n:Ticket) REQUIRE n.graph_key IS UNIQUE;

CREATE CONSTRAINT graph_person_key IF NOT EXISTS
FOR (n:Person) REQUIRE n.graph_key IS UNIQUE;

CREATE CONSTRAINT graph_user_account_key IF NOT EXISTS
FOR (n:UserAccount) REQUIRE n.graph_key IS UNIQUE;

CREATE CONSTRAINT graph_device_key IF NOT EXISTS
FOR (n:Device) REQUIRE n.graph_key IS UNIQUE;

CREATE CONSTRAINT graph_organization_key IF NOT EXISTS
FOR (n:Organization) REQUIRE n.graph_key IS UNIQUE;

CREATE CONSTRAINT graph_software_key IF NOT EXISTS
FOR (n:Software) REQUIRE n.graph_key IS UNIQUE;

CREATE CONSTRAINT graph_alert_key IF NOT EXISTS
FOR (n:Alert) REQUIRE n.graph_key IS UNIQUE;

CREATE CONSTRAINT graph_integration_event_key IF NOT EXISTS
FOR (n:IntegrationEvent) REQUIRE n.graph_key IS UNIQUE;

// Lookup and traversal indexes
CREATE INDEX graph_ticket_lookup IF NOT EXISTS
FOR (n:Ticket) ON (n.tenant_id, n.ticket_id);

CREATE INDEX graph_person_lookup IF NOT EXISTS
FOR (n:Person) ON (n.tenant_id, n.canonical_user_key);

CREATE INDEX graph_user_account_lookup IF NOT EXISTS
FOR (n:UserAccount) ON (n.tenant_id, n.canonical_user_key);

CREATE INDEX graph_device_lookup IF NOT EXISTS
FOR (n:Device) ON (n.tenant_id, n.canonical_device_key);

CREATE INDEX graph_org_lookup IF NOT EXISTS
FOR (n:Organization) ON (n.tenant_id, n.canonical_org_key);

CREATE INDEX graph_software_lookup IF NOT EXISTS
FOR (n:Software) ON (n.tenant_id, n.software_key);

CREATE INDEX graph_alert_lookup IF NOT EXISTS
FOR (n:Alert) ON (n.tenant_id, n.alert_key);

CREATE INDEX graph_event_lookup IF NOT EXISTS
FOR (n:IntegrationEvent) ON (n.tenant_id, n.event_key);

CREATE INDEX graph_ticket_status IF NOT EXISTS
FOR (n:Ticket) ON (n.tenant_id, n.status, n.created_at);

CREATE INDEX graph_alert_severity IF NOT EXISTS
FOR (n:Alert) ON (n.tenant_id, n.severity, n.observed_at);

CREATE INDEX graph_device_last_check_in IF NOT EXISTS
FOR (n:Device) ON (n.tenant_id, n.last_check_in);

// Operational note:
// Every relationship created by projection must include:
// tenant_id, source_system, source_ref, observed_at, confidence, provenance_version
// Optional ranking fields: severity, recency_weight, frequency_weight, relation_role
