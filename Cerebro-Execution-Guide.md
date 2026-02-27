# Cerebro Execution Guide
**Date:** February 2026  
**Version:** 2.0 (chronological rewrite)  

This document is an execution guide with `Execution PRD (P0/P1/P2)` as the primary priority source.  
Phases describe sequencing; appendices contain reference architecture and quality constraints.

---

## Operating Rules (do not skip)
### Fixed launch policies (P0)
- **Autotask is the only two-way integration in P0.** All other integrations remain **read-only** at launch.
- **Internal dogfooding only** until the founder explicitly switches to external controlled launch.
- Prefer **end-to-end workflow completion** over broad feature surface area.
- **Execution PRD priority rule:** sequencing and scope decisions follow the **Execution PRD (P0/P1/P2)** section first; phase chronology must not expand scope beyond backlog priority.

### Definition of Done (DoD) for any phase
A phase is “done” only when:
- The gate is met.
- Evidence artifacts are captured (see each phase).
- Degraded mode/rollback is defined and testable (when applicable).

Notation used below:
- `~~strikethrough~~` = implemented and verified in the current repo snapshot.

---

## SSOT: Execution PRD + Implementation Sequence

Goal: translate strategy into an executable backlog by workflow and by integration, preserving commercial focus for launch.

#### P0 (Must Ship, Commercial Launch)

##### Critical Workflows
- **F0. Intake & Triage:** unified inbox (chat/email), ticket create/update, AI triage with confidence and human review **[~ implemented in code; pending Refresh internal validation]**
- **F1. Dispatch & Routing:** assign/reassign, priority, internal comments, routing rules **[~ implemented in code; pending Refresh internal validation]**
- **F2. Technician Context:** side panel with customer/ticket/device/docs/security context (Autotask + IT Glue + Ninja + SentinelOne + Check Point) **[~ implemented in code; pending Refresh internal validation]**
- **F3. Handoff & Escalation:** AI summary, escalation tag, recent history and correlated alerts **[~ implemented in code; pending Refresh internal validation]**
- **F4. Manager Visibility:** queue, SLA risk, audit of automations/AI suggestions **[~ implemented in code; pending Refresh internal validation + runbooks]**

##### Integrations (Launch)
- **Autotask (P0):** ticket CRUD/sync, contacts/companies, assisted time entries, basic reconciliation (**100% two-way / manageable via Cerebro**) **[~ core two-way workflow implemented; live E2E with real credentials pending]**
- **IT Glue (P0):** contextual lookup by customer/site/device, suggested links/runbooks, cache and per-tenant permissions (**read-only**) **[~ read-only enrichment implemented; internal validation pending]**
- **Ninja (P0):** alert ingestion, correlation by device/customer, ticket enrichment, device status (**read-only**) **[~ read-only enrichment implemented; internal validation pending]**
- **SentinelOne (P0):** ingest/lookup alerts/incidents and endpoint/security context for triage/handoff (**read-only**) **[~ read-only enrichment implemented; internal validation pending]**
- **Check Point (P0):** lookup/ingest perimeter/network/security context for troubleshooting (**read-only**) **[~ read-only enrichment implemented; internal validation pending]**

##### Platform / Operations (P0)
- **Tenant isolation + RBAC** **[x implemented baseline in CP0]**
- **Observability (correlated logs/metrics/traces)** **[x baseline implemented in CP0]**
- **Retry/DLQ/idempotency for integrations** **[x skeleton/baseline implemented; [~] durable backing pending]**
- **Per-tenant feature flags** **[x scaffold implemented; [~] rollout hardening pending]**
- **Audit trail for AI and automation decisions** **[x implemented baseline + P0 workflow/AI coverage]**

##### P0-GRAPH Blueprint (Neo4j + GDS Adaptation)
Goal: add a mature graph analytics layer for cross-referencing while preserving current `PrepareContext` safety controls.

1) Scope and boundaries
- Keep `Postgres` as source of truth for ticket/workflow state.
- Build a tenant-scoped graph projection in `Neo4j` for read-optimized traversal and analytics.
- Keep write actions in existing workflow engines; graph layer is decision-support/evidence only in P0.

2) Graph projection model (minimum)
- Nodes: `Tenant`, `Ticket`, `Person`, `UserAccount`, `Device`, `Organization`, `Software`, `Alert`, `IntegrationEvent`.
- Relationships: `REQUESTED_BY`, `AFFECTS`, `LOGGED_IN_ON`, `BELONGS_TO_ORG`, `MENTIONS_SOFTWARE`, `OBSERVED_IN_ALERT`, `HAS_EVENT`.
- Every node/edge must carry `tenant_id`, `source_system`, `source_ref`, `observed_at`, `confidence`, `provenance_version`.

3) Projection pipeline
- Trigger projection job after SSOT persistence and after major enrichment updates (`round 7/8/9` outputs).
- Use idempotent upserts keyed by deterministic IDs (`tenant_id + entity_type + canonical_key`).
- Keep checkpoint cursor per tenant (`last_projected_ticket_ssot_version`) for replay-safe backfills.
- DLQ failed projection batches with correlation IDs and explicit retry metadata.

4) Algorithm pack (initial)
- `Louvain` for community clustering (entity/device/software co-occurrence clusters).
- `PageRank` for centrality/risk amplification in tenant-local interaction graph.
- `Shortest Path` (weighted) for causal hint chains between actor/device/alert/software.
- `Node Similarity` for candidate historical analogs beyond lexical ticket matching.

5) Result integration into Cerebro
- Persist graph outputs into `ticket_context_appendix.graph_hints` and `fusion_audit.graph_support`.
- Output contract per hint:
  - `hint_type` (`community_risk|centrality_risk|causal_path|similar_case_graph`)
  - `score` (0-1), `confidence` (0-1), `evidence_refs`, `path_entities`, `algorithm`, `algorithm_version`, `projection_version`.
- Graph hints are advisory only; policy gates continue to govern any actionable workflow decisions.

6) Safety and policy guards (mandatory)
- Strict tenant partitioning in graph keys, projection jobs, and query filters (`tenant_id` required at every query entrypoint).
- Reject cross-tenant traversals by design (query templates include tenant anchor node).
- Keep AI/HITL guardrails unchanged: low-confidence or sensitive hints route to human review.
- Audit every graph query invocation with `tenant_id`, `ticket_id`, `trace_id`, algorithm, and result hash.

7) Rollout plan
- Stage A: shadow mode (compute hints, do not display/apply).
- Stage B: read-only UI exposure in technician context panel with evidence/provenance.
- Stage C: consume hints in ranking/calibration logic with conservative weights and rollback flags.
- Stage D: per-tenant enablement via rollout flags (`p0.graph.*`) with instant disable path.

8) Acceptance criteria (P0-GRAPH gate)
- Deterministic replay of projection for same SSOT snapshot yields same graph entities/edges.
- No cross-tenant leakage in graph queries (negative tests required).
- At least one validated improvement in troubleshooting correlation quality versus baseline history-only matching.
- Full degraded mode: if graph layer unavailable, `PrepareContext` and workflow engine continue without blocking.

9) Operational metrics
- Projection latency P95, query latency P95, graph hint generation success rate.
- Graph hint adoption/override rates in HITL review.
- False-positive and unsupported-hint rates with weekly QA sampling.

#### P1 (Should Ship, Immediate Post-Launch Expansion)

##### Workflows
- **Voice AI (initial phase):** basic answering + transcript + handoff
- **Two-way SMS:** updates and simple conversations
- **Workflow builder (v1):** no-code rules for common MSP scenarios
- **ROI Analytics (v1.5):** richer dashboards by tenant/customer

##### Integrations
- **ConnectWise Manage**
- **HaloPSA**
- **Additional documentation/knowledge connectors** (Confluence/SharePoint)
- **Assisted (HITL) actions in SentinelOne / Check Point** per policies and audit

#### P2 (Could Ship, Advanced Differentiation)

##### Workflows / AI
- **Controlled agentic workflows** (assisted execution with policy gates)
- **Advanced graph analytics expansion** (beyond P0 graph baseline)
- **Predictive analytics** (repeat incidents, SLA risk, forecasting)
- **Runbook generation & optimization loop**

##### Integrations
- **RMM expansion** (Kaseya, N-able, etc.)
- **PSA/ITSM expansion** (Jira SM, Freshservice, Zendesk, etc.)


##### Execution Sequence (Phase 0 -> Phase 6)
Integrated in the same SSOT as backlog priorities.

##### Phase 0: Foundations Skeleton
###### Objective
~~Stand up a tenant-safe runtime (API + workers + queue + storage) with observability and audit from day 1.~~

###### Scope
**In**
- ~~Tenant model + RBAC hooks~~
- ~~Queue runtime + retry/DLQ skeleton~~
- ~~Audit trail + feature flags scaffolding~~
- ~~Integration credential management baseline~~
- ~~Minimal health checks and operational signals~~

**Out**
- Full UI polish
- Full AI engine
- Non-Autotask two-way actions

###### Prerequisites
~~None.~~

###### Steps (in order)
1) ~~Implement tenant scoping in API + storage boundaries~~  
2) ~~Stand up worker runtime and queue processing skeleton~~  
3) ~~Add audit trail primitives for commands + AI suggestions~~  
4) ~~Add feature flags and integration policy guardrail (two-way vs read-only)~~  
5) ~~Add baseline observability: correlated logs/metrics/traces~~  

###### Gate (exit criteria)
- ~~API + worker runtime operational~~
- ~~Tenant scoping and audit hooks verified end-to-end~~
- ~~Queue + retry + DLQ skeleton works with a dummy job~~
- ~~Integration policy enforcement is testable~~

###### Evidence to capture
- ~~Test pack results for tenant scoping + audit + queue primitives~~
- ~~A sample audit log entry generated by a command stub~~
- ~~A screenshot/log of correlation IDs flowing (tenant_id/ticket_id/trace_id)~~

###### Rollback / degraded mode
- ~~If worker runtime fails, API remains up and returns safe error states.~~
- ~~Integrations can be disabled per-tenant via feature flags.~~

---

##### Phase 1: Autotask 100% API Coverage (E2E)
###### Objective
Deliver **100% Autotask REST API-manageable coverage** in Cerebro (within tenant permissions), with idempotent, auditable, replay-safe execution and reconciliation.

###### Scope
**In**
- Full Autotask entity capability matrix (CRUD/query/actions) for all API-manageable domains used by Refresh
- Typed command/query contracts per entity family (tickets, notes, checklist items, time entries, contacts/companies, related supported entities)
- Inbound sync ingestion normalization for managed entity domains (polling/webhook where supported)
- Idempotency keys + retry/DLQ + error taxonomy across all write-capable Autotask operations
- Reconciliation and drift detection per managed entity domain
- End-to-end auditability for command/query execution, sync, and reconcile

**Out**
- Two-way writes to any other system
- P1/P2 non-Autotask feature expansion

###### Prerequisites
- ~~Phase 0 done~~
- Autotask contract freeze completed with capability matrix and zero tolerated exclusions for Phase 1 closure

###### Steps (in order)
1) Freeze full Autotask capability matrix (entity + operation + constraints)  
2) Implement/verify handlers and query paths for all approved API-manageable operations  
3) Enforce idempotency + replay-safe processing for all write-capable paths  
4) Verify sync ingestion normalization for managed entity domains  
5) Verify reconciliation path and divergence classification/remediation per entity domain  
6) Harden retry/backoff + DLQ behavior for retryable failures across operation classes  
7) Ensure audit coverage for process/sync/reconcile outcomes with correlation IDs  
8) Execute live E2E proof set covering critical operation classes beyond ticket-only flow  

###### Phase 1 contract freeze artifacts
- `packages/types/src/autotask-two-way-contract.ts`
- `docs/contracts/autotask-phase1-two-way-freeze.md`
- `docs/contracts/autotask-phase1-full-api-capability-matrix.md`

###### Gate (exit criteria)
- 100% of Autotask API-manageable scope in the approved capability matrix is implemented in engine (`excluded_* = 0`)
- Write-capable operations are idempotent/replay-safe and policy-enforced
- Sync ingestion and reconciliation are operational for managed entity domains
- Audit trail covers execution lifecycle with correlation metadata

###### Evidence to capture
- Full capability matrix with implementation status (`implemented` only for Phase 1 closure)
- Live E2E logs for representative operation classes (not only ticket status flow)
- Idempotency replay proof across multiple write operation classes
- Reconciliation sample set per entity domain with match/mismatch handling evidence
- Audit coverage proof for lifecycle events and correlation IDs

###### Rollback / degraded mode
- If Autotask is down/rate-limited, commands queue and surface actionable pending/degraded state for managed operation paths
- Per-tenant “disable writes” flag forces read-only mode immediately for all Autotask write paths
- Use operation-level guardrails to disable specific action classes if needed without full Autotask shutdown

---

##### Phase 2: Inbox Workflow Core (usable day-to-day)
###### Objective
Make Cerebro operationally usable: a technician/dispatcher can work tickets without fighting the system.

###### Scope
**In**
- Inbox list + ticket detail + basic actions (assign/status/comment)
- Internal vs public comments
- Basic threading (chat/email ingestion projection)
- Realtime updates (SSE/WebSocket) for ticket state changes

**Out**
- Full manager dashboards
- Advanced workflow builder

###### Prerequisites
- Phase 1 done (two-way commands power the actions)

###### Steps (in order)
1) ~~Implement inbox projection from canonical ticket state~~  
2) ~~Implement ticket detail view data contract~~  
3) ~~Wire UI actions to Autotask command API (two-way)~~  
4) Add realtime updates for state changes  
5) Harden error states (pending, failed, retrying)  

###### Gate (exit criteria)
- Inbox + ticket detail works for real internal tickets
- Actions reflect in Autotask and return to Cerebro state
- Basic error handling is not catastrophic (no blank screens)

###### Evidence to capture
- Screen recording showing: open ticket → assign → comment → status change → state updates
- A set of “failure screenshots” (rate limit, auth expired, Autotask error) showing safe UX

###### Rollback / degraded mode
- If realtime gateway fails, UI falls back to polling.
- If Autotask writes disabled, UI switches to read-only and shows clear banner.

---

##### Phase 3: Read-only Enrichments (Context that differentiates)
###### Objective
Deliver troubleshooting advantage with **zero external risk**: pull context, normalize, and present it as evidence.

###### Scope
**In**
- IT Glue, Ninja, SentinelOne, Check Point adapters (read-only)
- Normalization into context cards + evidence records
- Cache/timeouts and “partial context” states

**Out**
- Any “push” action into security tools (P1+)

###### Prerequisites
- Phase 0 foundations (credentials, tenant policy)
- Inbox ticket detail contract (Phase 2) to display context

###### Steps (in order)
1) ~~Implement adapter health check + connectivity status per integration~~  
2) ~~Implement read-only fetch/lookup operations per system~~  
3) ~~Normalize into canonical context schema (Appendix A contract)~~  
4) ~~Attach context to ticket as evidence records with provenance~~  
5) ~~Add cache/timeouts; enforce “no external mutation” at adapter boundary~~  

###### Gate (exit criteria)
- Context cards appear for real internal tickets
- Read-only policy is enforced (attempted mutations are rejected + audited)
- Timeouts/failures produce “partial context” not “broken workflow”

###### Evidence to capture
- One ticket with all 4 enrichments visible (or the ones you have credentials for)
- Logs showing provenance metadata captured
- A forced-failure test (one integration down) with correct degraded behavior

###### Rollback / degraded mode
- Each enrichment is independently disableable per tenant.
- If an integration fails, the rest still load and the inbox remains usable.

---

##### Phase 4: AI Assist (HITL first) + Audit
###### Objective
Make AI useful without operational risk: suggestions and drafts with confidence, audit, and human approval where needed.

###### Scope
**In**
- AI triage suggestions + confidence + rationale/provenance
- AI summary/handoff draft using enrichment evidence
- Policy gates + HITL routing
- QA sampling loop and version logging

**Out**
- Full autonomous remediation (P2)
- Auto-resolution except explicitly approved low-risk flows

###### Prerequisites
- Audit trail + policy layer (Phase 0)
- Enrichment evidence records (Phase 3)

###### Steps (in order)
1) Implement triage inference pipeline that consumes ticket + evidence snapshot  
2) Emit confidence + rationale/provenance  
3) Enforce policy gates for action types (field suggestions vs routing vs responses)  
4) Implement HITL approvals for sensitive/low-confidence paths  
5) Add audit logging for model/prompt versions and decision outcomes  
6) Implement QA sampling workflow + defect log loop  

###### Gate (exit criteria)
- AI generates suggestions and drafts reliably with auditable provenance
- HITL works (a human can accept/edit/reject)
- Audit records exist for every AI decision
- A minimal QA sampling cycle is runnable weekly

###### Evidence to capture
- 10-ticket sample: AI suggestion + human outcome + audit entry
- A prompt/model version change with rollback proof
- A “low confidence” example routed to HITL correctly

###### Rollback / degraded mode
- AI features are feature-flagged per tenant and can be disabled instantly.
- If AI is down, workflows continue without AI (no blocking).

---

##### Phase 5: Manager Ops + Controls (operational trust)
###### Objective
Give managers visibility, controls, and confidence to adopt the system.

###### Scope
**In**
- Queue/SLA dashboard (minimum)
- Automation/AI audit views
- Rollout control surfaces (feature flags, modes)
- Runbooks for degraded mode and reconciliation

**Out**
- Full ROI analytics suite (P1)
- No-code workflow builder (P1)

###### Prerequisites
- Reliable audit + telemetry from phases 0-4

###### Steps (in order)
1) Implement manager views over queue + SLA risk  
2) Implement audit views for AI + automation decisions  
3) ~~Implement per-tenant rollout controls and operating mode switch (internal-only vs external)~~  
4) ~~Write runbooks for: Autotask failure, enrichment failure, AI failure, reconciliation mismatch~~  

###### Gate (exit criteria)
- Manager can see backlog and SLA risk without opening PSA
- Manager can audit AI/automation decisions
- Runbooks exist and can be executed without guesswork

###### Evidence to capture
- Screenshots of manager dashboards populated by real data
- A runbook drill log (one simulated incident executed end-to-end)

###### Rollback / degraded mode
- Rollout controls allow disabling each subsystem independently.
- Fallback path is always “manual operation in PSA.”

---

##### Phase 6: Hardening + Drills (make it boring)
###### Objective
Turn the system into something you can trust daily: failure handling, repeatability, and operational muscle memory.

###### Scope
**In**
- DLQ + replay
- Rate limit handling, credential expiry, timeouts
- Data integrity checks and reconciliation remediation
- Rollback drills and hypercare signals

###### Prerequisites
- Phases 0-5 functional

###### Steps (in order)
1) Implement DLQ viewer + replay tooling  
2) Add rate limit + retry budget policies per integration  
3) Add credential health + expiry detection and safe UX messaging  
4) Run reconciliation mismatch simulation and remediation  
5) ~~Execute rollback drills (feature flag disable, write disable, integration disable)~~  
6) Start an internal dogfooding scorecard (daily reliability + throughput + quality)  

###### Gate (exit criteria)
- A failed job can be replayed safely
- Degraded modes are proven, not theoretical
- Rollback drills executed and documented
- Dogfooding scorecard is running and informs priority

###### Evidence to capture
- DLQ replay demo (log + outcome)
- Rollback drill checklist with timestamps
- Week 1 scorecard snapshot

###### Rollback / degraded mode
- This phase is literally about proving rollback works.

---

# Appendix A: Architecture Map (reference only)
This section defines the target runtime architecture for implementation sequencing. It is intentionally delivery-oriented (what to build first, what can wait).

#### 1. Architectural Principles (Implementation)
- **Workflow-first parity:** prioritize end-to-end workflow completion over broad feature surface area
- **Autotask as the system-of-record bridge:** P0 write operations are mediated through Cerebro with explicit auditability
- **Read-only enrichment by default:** non-PSA integrations enrich context without changing external state at launch
- **Event-driven integration boundary:** sync and enrichment logic runs in workers, not request/response UI paths
- **Tenant-safe by construction:** tenant scoping enforced at API, worker, queue, and storage layers

#### 2. Logical Services (P0)
- **Cerebro API (Control Plane):**
  - auth/session + RBAC
  - inbox APIs
  - ticket command APIs (Autotask two-way operations)
  - workflow/approval APIs
  - audit trail + feature flags
- **Orchestrator/Worker Runtime (Execution Plane):**
  - Autotask sync workers (commands + reconciliation)
  - enrichment workers (IT Glue, Ninja, SentinelOne, Check Point)
  - AI triage/assist workers
  - retry/DLQ workers
- **Realtime Gateway:**
  - WebSocket/SSE updates for inbox/ticket state
  - job progress/status fanout to UI
- **Policy & Quality Gate Layer:**
  - AI confidence thresholds
  - HITL approval routing
  - action eligibility (two-way vs read-only)

#### 3. Integration Adapter Architecture
- **Adapter Contract (all integrations):**
  - `auth/credentials resolver`
  - `connectivity health check`
  - `fetch/lookup operations`
  - `normalize -> canonical event/context schema`
  - `audit metadata + provenance`
- **Autotask Adapter (P0 two-way):**
  - commands: create/update/assign/status/time-entry (scope-controlled)
  - inbound sync: webhook/polling + reconciliation
  - idempotency keys and replay-safe writes
- **IT Glue / Ninja / SentinelOne / Check Point Adapters (P0 read-only):**
  - pull/lookup context and alerts/incidents/events
  - normalize into ticket context cards + evidence records
  - no external mutations at launch (enforced by adapter policy)

#### 4. Data & Storage Architecture (P0)
- **PostgreSQL (system state):**
  - tenants, users, roles
  - tickets (canonical Cerebro view)
  - integration configs + credentials metadata
  - command logs / audit trail / approvals
  - sync checkpoints / reconciliation state
- **Redis (runtime):**
  - job queues
  - locks (idempotent command processing)
  - ephemeral cache (ticket context fragments, health status)
- **Search / Vector (optional P0, hard-required by P1 depending UX):**
  - KB retrieval
  - semantic matching for triage assist and runbook suggestions
- **Object Storage:**
  - transcripts, attachments, exported diagnostics, audit artifacts

#### 5. Canonical Data Flow (P0)
1. **Intake** (chat/email) enters Cerebro API
2. **Triage request** is created with tenant-scoped context snapshot
3. **AI worker** produces suggestions + confidence + rationale/provenance
4. **Policy gate** evaluates:
   - Autotask write allowed? (yes, if command scope + confidence + rules pass)
   - Non-PSA enrichments remain read-only
5. **Autotask command worker** executes two-way command with idempotency
6. **Enrichment workers** collect IT Glue / Ninja / SentinelOne / Check Point context
7. **Realtime gateway** publishes updated ticket/context/audit state
8. **Reconciliation worker** validates external ↔ internal consistency

#### 6. Deployment Topology (Founder + AI Agents Friendly)
- **API service** (single deployable)
- **Worker service** (horizontal scaling later; single process ok for internal validation)
- **Queue/Redis**
- **Postgres**
- **Optional search/vector services**
- **Observability stack**

P0 recommendation: start with a simple topology that supports the contracts above; avoid premature microservice splits.

---

---

# Appendix C: NFRs + AI Quality Gates (reference only)
## NFRs
#### 1. SLO / Performance / Availability
- **Local UI actions (cache/UI state):** P95 < 150ms
- **AI triage suggestion (no external PSA write):** P95 < 3s
- **PSA round-trip (Autotask create/update):** P95 < 5s, with queue and retry
- **Event ingestion (Ninja / SentinelOne / Check Point → visible in Cerebro):** P95 < 30s
- **Platform availability (core inbox + API):** 99.9% monthly (launch target)
- **RPO / RTO (production):** RPO <= 15 min, RTO <= 4h (initial target)

#### 2. Security / Multi-Tenant / Compliance
- **Tenant Isolation:** strict logical isolation across data, queues, caches, and indices
- **RBAC:** Admin / Manager / Technician / Viewer scoped per tenant
- **Audit Trail:** critical actions and automation decisions logged (who/what/when)
- **Secrets Management:** encrypted integration credentials + rotation support
- **Encryption:** TLS in transit + encryption at rest
- **Data Retention Policies:** configurable per tenant (logs, transcripts, auditing)
- **PII Handling:** redaction/masking in logs and training datasets

#### 3. Observability / Operations
- **3 required signals:** metrics, logs, traces (correlated by `trace_id` / `tenant_id` / `ticket_id`)
- **Health checks:** API, workers, queues, integrations (Autotask/IT Glue/Ninja/SentinelOne/Check Point)
- **Alerting:** sync errors, queue backlog, webhook/poller failure, degraded latency
- **Operational dashboards:** event volume, retries, DLQ, per-integration success
- **Operational runbooks:** incident response for integration failures and partial degradation

#### 4. Rollout / Fallback / Resilience
- **Per-tenant feature flags:** controlled rollout (AI triage, automations, enrichments)
- **Progressive rollout:** internal pilot → design partners → expanded cohort
- **Manual fallback:** any critical automation must allow human override
- **Launch integration guardrail:** only `Autotask` runs two-way; other integrations stay read-only until explicit release
- **Retry + DLQ:** async integrations with idempotency and dead-letter queue
- **Degraded mode:** external integration failures must not take down the inbox/core UX
- **Backfill/Reconciliation:** reconciliation jobs for sync divergence

### AI Quality Gates (Thresholds + HITL + Audit)

#### 1. Confidence Policy by Action Type
- **Field suggestions (title/category/type):** allow auto-fill visuals with confidence >= 0.70
- **Priority/routing:** auto-apply only with confidence >= 0.85 and compatible business rules
- **Auto-response to customer:** requires confidence >= 0.90 + validated KB/runbook match
- **Auto-resolution:** allowed only in explicitly approved workflows (FAQ/low-risk)

#### 2. Human-in-the-Loop (HITL)
- **Mandatory approval:** P1/P2, VIP customers, negative sentiment, low confidence, sensitive categories
- **Minimum explainability:** show signals used (keywords, history, KB match, device alert)
- **One-click feedback:** Accept / Edit / Reject to improve prompts/models
- **Escalation path:** if low confidence or signal conflict, send to manager/dispatcher

#### 3. Continuous Audit and QA
- **Sampling QA:** review samples of triage, routing, auto-responses, and auto-resolutions
- **Golden set per tenant/segment:** regression set before changes to prompts/models
- **Prompt/model versioning:** log the version used for every AI decision
- **Operational rollback:** revert prompt/model version per tenant/cohort
- **AI quality KPIs:** acceptance rate, override rate, false-escalation rate, false-auto-resolve rate

---

## Progress Snapshot
Current implementation/progress tracking moved to: `Cerebro-Execution-Status.md`.
