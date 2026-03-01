// Cerebro P0-GRAPH Query Templates
// Purpose: concrete Cypher seeds for the initial query surface.
// Status: implementation seed; parameters and limits are explicit by design.

// ------------------------------------------------------------
// graph.expandContext(tenant_id, ticket_id, depth=2, max_nodes=80)
// ------------------------------------------------------------
MATCH (tenant:Tenant { tenant_id: $tenant_id })
MATCH (ticket:Ticket { tenant_id: $tenant_id, ticket_id: $ticket_id })
MATCH p = (ticket)-[*1..$depth]-(neighbor)
WHERE ALL(r IN relationships(p) WHERE r.tenant_id = $tenant_id)
WITH ticket, p, neighbor
ORDER BY length(p) ASC
WITH ticket, collect(DISTINCT p)[0..$max_nodes] AS paths
RETURN ticket, paths;

// ------------------------------------------------------------
// graph.findSimilarIncidents(tenant_id, ticket_id, top_k=5)
// Similarity seed: shared device/software/requester overlap with recency bias.
// ------------------------------------------------------------
MATCH (src:Ticket { tenant_id: $tenant_id, ticket_id: $ticket_id })
OPTIONAL MATCH (src)-[:AFFECTS { tenant_id: $tenant_id }]->(srcDevice:Device)
OPTIONAL MATCH (src)-[:MENTIONS_SOFTWARE { tenant_id: $tenant_id }]->(srcSoftware:Software)
OPTIONAL MATCH (src)-[:REQUESTED_BY { tenant_id: $tenant_id }]->(srcPerson:Person)
MATCH (other:Ticket { tenant_id: $tenant_id })
WHERE other.ticket_id <> src.ticket_id
OPTIONAL MATCH (other)-[:AFFECTS { tenant_id: $tenant_id }]->(otherDevice:Device)
OPTIONAL MATCH (other)-[:MENTIONS_SOFTWARE { tenant_id: $tenant_id }]->(otherSoftware:Software)
OPTIONAL MATCH (other)-[:REQUESTED_BY { tenant_id: $tenant_id }]->(otherPerson:Person)
WITH src, other,
     CASE WHEN srcDevice IS NOT NULL AND otherDevice IS NOT NULL AND srcDevice.graph_key = otherDevice.graph_key THEN 0.45 ELSE 0 END AS device_score,
     CASE WHEN srcSoftware IS NOT NULL AND otherSoftware IS NOT NULL AND srcSoftware.graph_key = otherSoftware.graph_key THEN 0.30 ELSE 0 END AS software_score,
     CASE WHEN srcPerson IS NOT NULL AND otherPerson IS NOT NULL AND srcPerson.graph_key = otherPerson.graph_key THEN 0.15 ELSE 0 END AS requester_score
WITH src, other, device_score + software_score + requester_score AS structural_score
WHERE structural_score > 0
RETURN other.ticket_id AS similar_ticket_id,
       structural_score AS similarity_score,
       other.status AS status,
       other.created_at AS created_at
ORDER BY similarity_score DESC, created_at DESC
LIMIT $top_k;

// ------------------------------------------------------------
// graph.findBlastRadius(tenant_id, anchor_type, anchor_key)
// ------------------------------------------------------------
MATCH (anchor { tenant_id: $tenant_id, graph_key: $anchor_key })
WHERE $anchor_type IN labels(anchor)
OPTIONAL MATCH (anchor)<-[*1..2]-(affected:Ticket { tenant_id: $tenant_id })
WHERE affected.ticket_id IS NOT NULL
RETURN anchor,
       collect(DISTINCT affected.ticket_id)[0..50] AS impacted_ticket_ids,
       count(DISTINCT affected) AS impacted_ticket_count;

// ------------------------------------------------------------
// graph.generateHints(tenant_id, ticket_id)
// Deterministic hint seed rules for P0.
// ------------------------------------------------------------
MATCH (ticket:Ticket { tenant_id: $tenant_id, ticket_id: $ticket_id })
OPTIONAL MATCH (ticket)-[:AFFECTS { tenant_id: $tenant_id }]->(device:Device)
OPTIONAL MATCH (ticket)-[:REQUESTED_BY { tenant_id: $tenant_id }]->(person:Person)
OPTIONAL MATCH (recentAlert:Alert { tenant_id: $tenant_id })-[:OBSERVED_IN_ALERT { tenant_id: $tenant_id }]->(device)
WHERE recentAlert.observed_at >= $alert_window_start
WITH ticket, device, person, collect(DISTINCT recentAlert)[0..10] AS recent_alerts
OPTIONAL MATCH (other:Ticket { tenant_id: $tenant_id })-[:AFFECTS { tenant_id: $tenant_id }]->(device)
WHERE other.ticket_id <> ticket.ticket_id AND other.status IN $active_statuses
WITH ticket, device, person, recent_alerts, collect(DISTINCT other.ticket_id)[0..10] AS sibling_tickets
RETURN {
  hint_type: CASE
    WHEN size(recent_alerts) > 0 THEN 'centrality_risk'
    WHEN size(sibling_tickets) > 1 THEN 'community_risk'
    ELSE 'similar_case_graph'
  END,
  score: CASE
    WHEN size(recent_alerts) > 0 THEN 0.85
    WHEN size(sibling_tickets) > 1 THEN 0.70
    ELSE 0.40
  END,
  confidence: CASE
    WHEN size(recent_alerts) > 0 THEN 0.80
    WHEN size(sibling_tickets) > 1 THEN 0.65
    ELSE 0.35
  END,
  summary: CASE
    WHEN size(recent_alerts) > 0 THEN 'Affected device has recent correlated alerts'
    WHEN size(sibling_tickets) > 1 THEN 'Affected device is shared across multiple active tickets'
    ELSE 'No strong graph signal; retain history-first fallback'
  END,
  path_entities: [x IN [ticket.graph_key, coalesce(device.graph_key, ''), coalesce(person.graph_key, '')] WHERE x <> ''],
  algorithm: 'deterministic_p0_rulepack',
  algorithm_version: 'v1',
  projection_version: $projection_version
} AS graph_hint;
