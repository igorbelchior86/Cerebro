# P0 Parallel Implementation Prompt Pack (3 Agents)

## Purpose

This document converts the P0 portion of the implementation plan into a 3-agent parallel execution prompt pack for the `Cerebro` repository.

Goals:
- enable parallel implementation with minimal overlap
- freeze shared contracts before deep implementation starts
- preserve launch policy (`Autotask` two-way; all other launch integrations read-only)
- make merge order, checkpoints, and acceptance criteria explicit

Assumptions and defaults:
- Scope: `P0 only`
- Output format: single Markdown prompt pack
- Execution model: Founder + AI Agents
- Prompt language: EN-US
- This document does not implement features; it defines implementation prompts

## Source of Truth

Primary source:
- `/Users/igorbelchior/Documents/Github/Cerebro/PRD-Exec-EN-US.md` (`## 5. Milestones (Board-Level)` -> `### What / When to Implement (Executive View)`)

Supporting sources:
- `/Users/igorbelchior/Documents/Github/Cerebro/PRD-Tech-EN-US.md` (`### Target Implementation Architecture (P0/P1)`)
- `/Users/igorbelchior/Documents/Github/Cerebro/PRD-Tech-EN-US.md` (`### Implementation Plan (What / When)`)
- `/Users/igorbelchior/Documents/Github/Cerebro/PRD-Tech-EN-US.md` (`### Execution PRD (Prioritized Backlog P0 / P1 / P2)`)
- `/Users/igorbelchior/Documents/Github/Cerebro/PRD-Tech-EN-US.md` (`### Non-Functional Requirements (NFRs)`)
- `/Users/igorbelchior/Documents/Github/Cerebro/PRD-Tech-EN-US.md` (`### AI Quality Gates (Thresholds + HITL + Audit)`)

## P0 Scope (What is in / out)

In scope (P0):
- Phase 0-3 implementation backbone for internal validation and launch readiness
- `Autotask` two-way ticket operations through Cerebro (managed via Cerebro)
- read-only enrichments for `IT Glue`, `Ninja`, `SentinelOne`, and `Check Point`
- AI triage/assist (suggestion-first) with confidence/provenance/HITL policy gates
- manager visibility for queue/SLA/audit, plus operational hardening (retry/DLQ/reconciliation/degraded mode)

Out of scope (P0):
- write actions for non-`Autotask` integrations
- Voice AI and two-way SMS
- advanced workflow builder v1
- ConnectWise/HaloPSA integrations
- autonomous/agentic execution and advanced predictive analytics

## Global Constraints and Guardrails

- Launch integration policy (P0):
  - `Autotask` = two-way
  - `IT Glue` = read-only
  - `Ninja` = read-only
  - `SentinelOne` = read-only
  - `Check Point` = read-only
- Maintain strict tenant isolation across API, workers, queues, caches, and storage
- Preserve retry/DLQ/idempotency semantics for integration and async flows
- Preserve auditability and correlation IDs (`trace_id`, `tenant_id`, `ticket_id`)
- AI actions/suggestions must not bypass confidence thresholds and HITL rules
- Any code change executed from these prompts must include wiki documentation under `/wiki`
- Prefer additive, P0-focused implementation over invasive refactors

## Shared Contracts (Freeze Before Parallel Work)

These contracts must be agreed/frozen by Agent A before Agents B and C begin deep implementation. If a change is needed later, it must be proposed and merged into the frozen contract first.

### Canonical Ticket Model (P0 fields)

Required fields (minimum):
- `ticket_id` (Cerebro canonical ID)
- `external_refs` (source/system IDs, including Autotask ticket ID)
- `tenant_id`
- `status`
- `priority`
- `assignment` (user/team)
- `source_channel` (chat/email)
- `requester` (customer/contact reference)
- `timestamps` (`created_at`, `updated_at`)

Rules:
- tenant-scoped by construction
- external system references must include provenance (`source`, `fetched_at`)
- no adapter-specific fields leak into the canonical core object

### Ticket Context Envelope

Purpose:
- normalized wrapper for side-panel enrichment/context cards and evidence records

Required shape (conceptual):
- `ticket_id`
- `tenant_id`
- `cards[]` (source-specific normalized cards)
- `evidence[]` (alerts/incidents/docs/device events)
- `provenance` (source, fetch time, adapter version)
- `policy` (`mode=read_only|two_way`, enforcement metadata)
- `correlation` (`trace_id`, `ticket_id`, optional `job_id`)

Supported P0 source cards:
- `Autotask`
- `IT Glue`
- `Ninja`
- `SentinelOne`
- `Check Point`

### Command Envelope (Autotask two-way)

Purpose:
- normalized command payload for all P0 write-capable actions routed through Cerebro to Autotask

Required fields:
- `command_id`
- `tenant_id`
- `target_integration` (`Autotask` only in P0)
- `command_type` (create/update/assign/status/time_entry)
- `payload`
- `actor` (user/system/AI with origin)
- `idempotency_key`
- `audit_metadata`
- `correlation` (`trace_id`, `ticket_id`, `job_id`)
- `requested_at`

Rules:
- non-`Autotask` commands must be rejected at validation/policy layer in P0
- commands must be replay-safe or idempotency-protected

### Event Envelope

Purpose:
- normalized event schema for worker pipeline, sync events, and UI updates

Required fields:
- `event_id`
- `tenant_id`
- `event_type`
- `source`
- `entity_type`
- `entity_id`
- `payload`
- `occurred_at`
- `correlation` (`trace_id`, `ticket_id`, `job_id`)
- `provenance`

Rules:
- events must be safe for retries and duplicate delivery handling
- event consumers must not assume exactly-once delivery

### Audit Record Schema

Required fields:
- `audit_id`
- `tenant_id`
- `actor`
- `action`
- `target`
- `result` (success/failure/rejected)
- `reason` (when applicable)
- `timestamp`
- `correlation` (`trace_id`, `ticket_id`, `command_id`, `job_id`)
- `metadata` (policy decision, adapter info, AI provenance refs)

Rules:
- audit writes are required for command attempts, policy decisions, and AI decision records
- rejected actions (including read-only violations) must also be audited

### Integration Adapter Contract

Common required capabilities (all adapters):
- credentials/auth resolver
- connectivity health check
- fetch/lookup operations
- normalization into canonical event/context schema
- provenance/audit metadata emission

Mutation behavior contract:
- `Autotask` adapter may expose mutation operations in P0 (scope-limited)
- `IT Glue`, `Ninja`, `SentinelOne`, `Check Point` adapters must reject mutation operations in P0 with explicit typed errors and audit records

Operational contract:
- retry-safe behavior
- error classification for retry vs DLQ
- tenant-scoped credentials and requests

### AI Decision Record

Required fields:
- `decision_id`
- `tenant_id`
- `ticket_id`
- `decision_type` (triage/priority/routing/summary/handoff)
- `suggestion`
- `confidence`
- `rationale`
- `signals_used` / provenance references
- `hitl_status` (not_required/pending/approved/rejected)
- `prompt_version`
- `model_version`
- `timestamp`
- `correlation` (`trace_id`, `job_id`)

Rules:
- AI suggestions and AI-executed actions must be distinguishable
- policy gate outcome must be linked to the AI decision record

## Parallelization Strategy (3 Agents)

Agent mapping to P0 workstreams:
- Agent A = WS-A (Platform Foundations) + Phase 0 contract freeze
- Agent B = WS-B (Autotask Two-Way Core) + WS-C (Inbox & Workflow Core)
- Agent C = WS-D (AI Triage + Assist) + WS-E (Read-Only Context Enrichment) + WS-F (Manager Visibility + Ops Readiness, P0 subset)

Execution waves:
- Wave 0 (contract freeze): Agent A completes/finalizes shared contracts and cross-cutting scaffolding
- Wave 1 (parallel implementation): Agents B and C execute in parallel against frozen contracts
- Wave 2 (integration hardening): A/B/C converge for reconciliation, observability, audit, and E2E validation

Sync checkpoints:
- CP0 (end of Wave 0): contract freeze reviewed and accepted
- CP1 (mid Wave 1): interface conformance check (B/C vs frozen contracts)
- CP2 (end Wave 1): merge readiness check (tests + audit coverage + guardrails)
- CP3 (Wave 2): integrated E2E and degraded-mode verification

## Prompt A — Platform Foundations & Contracts

### Mission

Implement and/or define the P0 platform scaffolding and shared contracts used by all other agents. This is the contract-freeze owner for the 3-agent run.

### Scope (In / Out)

In:
- tenant scoping model and RBAC enforcement points
- API/worker split scaffolding
- queue runtime basics (including retry/DLQ skeleton)
- observability baseline (logs/metrics/traces + correlation IDs)
- feature flags and audit trail baseline
- integration credential management scaffold
- shared contracts freeze (canonical models/envelopes/adapter interfaces)
- launch policy enforcement primitive (two-way vs read-only)

Out:
- Autotask business command implementations and sync behavior details
- inbox UI workflow features
- AI triage/enrichment implementation logic (except contracts and policy hooks)
- manager dashboards (except telemetry/audit contracts needed by others)

### Dependencies (what must exist before starting)

- Source of truth PRDs available:
  - `/Users/igorbelchior/Documents/Github/Cerebro/PRD-Exec-EN-US.md`
  - `/Users/igorbelchior/Documents/Github/Cerebro/PRD-Tech-EN-US.md`
- Repository builds/runs in current branch baseline
- Founder confirms P0 launch policy remains unchanged (Autotask two-way; others read-only)

### Owned surfaces / file ownership rules

Own (high-level):
- shared domain contract types/schemas
- policy gate primitives and integration mode guardrail
- queue runtime primitives, retry/DLQ skeleton, idempotency helper primitives
- audit and observability primitives (correlation propagation baseline)
- tenant/RBAC enforcement middleware/hooks

Do not edit without coordination:
- Autotask adapter business logic owned by Agent B
- inbox/ticket command UX/API specifics owned by Agent B
- AI triage logic, enrichment adapters, and manager visibility surfaces owned by Agent C

### Required outputs

- frozen shared contracts (as code/types/docs in repo)
- baseline runtime wiring (API + worker + queue primitives)
- audit/observability primitives consumable by Agents B/C
- policy enforcement mechanism for integration mode (`two-way` vs `read-only`)
- documented integration error categories for retry vs DLQ routing

### Acceptance criteria

- shared contract definitions are stable and referenced by Agent B/C implementations
- queue/retry/DLQ skeleton exists and is executable/testable
- tenant/audit/correlation hooks exist in critical request/job paths
- integration mode guardrail is enforceable programmatically
- rejected read-only mutation attempts can be classified/audited (even if invoked by later agents)

### Tests / verification

- tenant-scope enforcement tests
- idempotency key handling unit tests (primitive level)
- audit trail emission tests (including rejection events)
- observability/correlation presence checks in core request/job flows
- policy guardrail tests (`Autotask` allowed for P0 write; others rejected)

### Non-functional constraints

- preserve tenant isolation and no cross-tenant cache/queue keys
- support correlated logs/metrics/traces with consistent identifiers
- fail safely; no fail-open write behavior
- design for degraded-mode operation of integrations without breaking core runtime

### Wiki documentation requirement

If code is changed, create/update wiki entries under `/wiki` covering:
- architecture contracts/foundations (`/wiki/architecture`)
- platform decisions (`/wiki/decisions`)
- change log (`/wiki/changelog`)

Use the local wiki template:
- `# Title`
- `# What changed`
- `# Why it changed`
- `# Impact (UI / logic / data)`
- `# Files touched`
- `# Date`

### Do-not-do list

- do not implement Autotask ticket command business behavior beyond primitives/contracts
- do not add write capabilities to non-`Autotask` adapters
- do not refactor unrelated product surfaces during P0
- do not change frozen contracts after CP0 without explicit contract update workflow

### Repeated guardrails (mandatory)

- `Autotask` is the only P0 two-way integration
- `IT Glue`, `Ninja`, `SentinelOne`, `Check Point` remain read-only in P0
- preserve retry/DLQ/idempotency, auditability, and tenant isolation
- any code changes require wiki documentation updates under `/wiki`

## Prompt B — Autotask Two-Way + Inbox Workflow Core

### Mission

Implement the P0 workflow backbone: unified inbox + ticket lifecycle command flow + Autotask two-way command/sync path, using Agent A’s frozen contracts and platform primitives.

### Scope (In / Out)

In:
- unified inbox P0 path (chat/email)
- ticket lifecycle APIs/commands
- assignment/routing basics
- internal/public comments support
- Autotask two-way command model implementation (against frozen `Command Envelope`)
- Autotask sync ingestion (webhook and/or polling per repo architecture)
- reconciliation/idempotency/error handling for the Autotask path
- audit records for user/system commands

Out:
- non-Autotask integration write actions
- advanced workflow builder
- Voice AI / SMS
- predictive analytics
- ConnectWise/HaloPSA and other P1/P2 integrations (except stubs/hooks if required)

### Dependencies (what must exist before starting)

- CP0 complete: Agent A shared contracts frozen and published
- queue/audit/observability primitives available from Agent A
- integration mode guardrail primitive available from Agent A
- tenant/RBAC primitives in place for ticket command paths

### Owned surfaces / file ownership rules

Own (high-level):
- inbox/ticket workflow APIs and command handlers (P0)
- Autotask adapter two-way command/sync behavior
- Autotask reconciliation and command execution retry/DLQ integration
- ticket command audit/provenance emission in owned flows

Do not edit without coordination:
- shared contract definitions and cross-cutting platform primitives (Agent A ownership)
- AI triage policy logic and enrichment/manager visibility surfaces (Agent C ownership)

### Required outputs

- working ticket create/update/assign path through Cerebro -> Autotask
- inbox state updates reflecting Autotask sync events reliably
- internal/public comments and routing/assignment basics for P0 workflow
- retry-safe command execution with audit/provenance
- reconciliation path that surfaces divergence (not silent drift)

### Acceptance criteria

- `Autotask` is the only two-way integration path in P0
- no command path exists for `IT Glue` / `Ninja` / `SentinelOne` / `Check Point` mutations
- core P0 ticket flow is operable end-to-end (create -> assign -> update)
- inbox reliably reflects Autotask state changes
- reconciliation detects and surfaces divergence conditions

### Tests / verification

- Autotask command idempotency tests
- webhook/polling sync tests (including duplicate/out-of-order scenarios if applicable)
- command audit/provenance checks
- E2E P0 happy path test (`create -> assign -> update`)
- failure-path tests: retry/DLQ behavior on Autotask API failure
- integration mode policy test ensuring non-Autotask writes are rejected in command path

### Non-functional constraints

- maintain tenant isolation across inbox, command, sync, and reconciliation flows
- preserve correlation IDs across request -> command -> worker -> sync update
- degraded Autotask failures must not crash inbox/core UX; surface operational state instead
- avoid long blocking operations on request path when worker/queue orchestration is available

### Wiki documentation requirement

If code is changed, create/update wiki entries under `/wiki` covering:
- workflow/ticket command behavior (`/wiki/features`)
- Autotask integration behavior and constraints (`/wiki/architecture` or `/wiki/features`)
- design/behavior decisions (`/wiki/decisions`)
- delivery notes (`/wiki/changelog`)

Use the local wiki template:
- `# Title`
- `# What changed`
- `# Why it changed`
- `# Impact (UI / logic / data)`
- `# Files touched`
- `# Date`

### Do-not-do list

- do not add write support for `IT Glue`, `Ninja`, `SentinelOne`, or `Check Point`
- do not implement P1/P2 channels/features (Voice AI, SMS, workflow builder)
- do not redefine shared contracts locally; request contract changes through CP0/contract owner flow
- do not bypass audit logging or idempotency protections for “quick fixes”

### Repeated guardrails (mandatory)

- `Autotask` is the only P0 two-way integration
- `IT Glue`, `Ninja`, `SentinelOne`, `Check Point` remain read-only in P0
- preserve retry/DLQ/idempotency, auditability, and tenant isolation
- any code changes require wiki documentation updates under `/wiki`

## Prompt C — AI Triage + Read-Only Enrichment + Manager Ops

### Mission

Implement Cerebro’s P0 differentiation/trust layer: AI triage + AI assist (suggestion-first), read-only context enrichments, and manager operational visibility/controls using Agent A’s frozen contracts and Agent B’s ticket workflow integration points.

### Scope (In / Out)

In:
- AI triage suggestion pipeline
- confidence score + rationale/provenance capture
- HITL policy gates (P0-sensitive cases)
- AI summary/handoff drafting
- read-only adapters/enrichment flows for:
  - `IT Glue`
  - `Ninja`
  - `SentinelOne`
  - `Check Point`
- manager visibility surfaces (P0):
  - queue/SLA visibility
  - automation/AI audit views
  - validation/QA sampling instrumentation
- degraded-mode handling for partial enrichment failures

Out:
- mutation/actions in `SentinelOne` / `Check Point`
- autonomous/agentic execution
- advanced analytics beyond P0/P1.5 hooks
- Voice AI and SMS
- ConnectWise/HaloPSA integration work

### Dependencies (what must exist before starting)

- CP0 complete: Agent A shared contracts frozen and published
- Agent A policy gate primitives, audit primitives, and observability correlation hooks available
- Agent B ticket/inbox workflow integration points available (or stubbed to frozen interfaces)
- launch integration policy unchanged for P0

### Owned surfaces / file ownership rules

Own (high-level):
- AI triage/assist pipeline and decision-record generation
- HITL policy gate configuration/flows on owned AI decisions
- read-only enrichment adapters and context/evidence normalization for P0 integrations
- manager visibility views/data pipelines for queue/SLA/audit/QA sampling (P0 subset)

Do not edit without coordination:
- shared contract definitions and platform primitives (Agent A ownership)
- Autotask two-way command/sync workflow internals and inbox core command handling (Agent B ownership)

### Required outputs

- AI suggestion records with confidence + rationale/provenance (`AI Decision Record`)
- read-only context cards/evidence for `IT Glue`, `Ninja`, `SentinelOne`, and `Check Point`
- explicit read-only adapter enforcement behavior (reject mutation paths + audit)
- manager-facing queue/SLA/audit visibility needed for internal validation
- AI summary/handoff draft flow that uses enriched evidence/provenance

### Acceptance criteria

- enrichments add context but never write to external state
- AI outputs are auditable and clearly distinguish suggestions vs actions
- HITL path triggers correctly for policy cases (low confidence, priority-sensitive, etc.)
- manager can inspect queue/SLA/audit signals for internal validation workflows
- partial enrichment failures degrade gracefully without breaking core ticket handling

### Tests / verification

- AI policy gate tests (threshold/HITL trigger scenarios)
- adapter read-only enforcement tests (mutation attempts rejected and audited)
- enrichment normalization/provenance tests for all 4 integrations
- manager visibility data integrity checks (queue/SLA/audit views)
- degraded-mode tests when one or more enrichments fail/unavailable
- AI decision record completeness checks (confidence, rationale, versions, provenance)

### Non-functional constraints

- preserve tenant isolation and per-tenant credentials for all enrichments
- maintain correlation IDs across AI and enrichment jobs (`trace_id`, `tenant_id`, `ticket_id`)
- no synchronous dependency on enrichment success for core inbox responsiveness
- auditable AI decisions with prompt/model version linkage

### Wiki documentation requirement

If code is changed, create/update wiki entries under `/wiki` covering:
- AI triage/assist behavior and HITL (`/wiki/features`)
- enrichment adapter contracts/limitations (`/wiki/architecture`)
- policy decisions/thresholds (`/wiki/decisions`)
- delivery notes (`/wiki/changelog`)

Use the local wiki template:
- `# Title`
- `# What changed`
- `# Why it changed`
- `# Impact (UI / logic / data)`
- `# Files touched`
- `# Date`

### Do-not-do list

- do not add write/mutation actions for `IT Glue`, `Ninja`, `SentinelOne`, or `Check Point` in P0
- do not bypass HITL or confidence thresholds for convenience
- do not build P1/P2 analytics/agentic features in this run
- do not silently alter Agent A contracts or Agent B command semantics

### Repeated guardrails (mandatory)

- `Autotask` is the only P0 two-way integration
- `IT Glue`, `Ninja`, `SentinelOne`, `Check Point` remain read-only in P0
- preserve retry/DLQ/idempotency, auditability, and tenant isolation
- any code changes require wiki documentation updates under `/wiki`

## Integration Mode Policy (Launch)

Authoritative P0 launch policy:
- `Autotask`: `two-way` (managed through Cerebro)
- `IT Glue`: `read-only`
- `Ninja`: `read-only`
- `SentinelOne`: `read-only`
- `Check Point`: `read-only`

Enforcement requirements:
- policy gate validates command eligibility before execution
- non-`Autotask` mutation attempts return explicit rejection and generate audit records
- adapter-level enforcement must backstop policy-layer enforcement

Change control:
- any deviation from this policy requires explicit founder approval and PRD/plan update before implementation

## Merge Order and Conflict Resolution

Recommended merge order:
1. Agent A first (contract freeze + platform foundations)
2. Agent B and Agent C in parallel (branch/rebase from Agent A contract baseline)
3. Integration merge pass
4. Hardening pass (reconciliation/observability/audit/degraded-mode completeness)

Conflict rules:
- If Agent B/C need contract changes:
  - propose changes against the frozen contract section
  - do not silently diverge in local implementations
- Ownership precedence:
  - Agent A owns shared contracts and cross-cutting primitives
  - Agent B owns Autotask two-way + inbox command workflow
  - Agent C owns AI/enrichment/manager ops surfaces
- Prefer additive integration over invasive refactors during P0

Wave checkpoints and expected artifacts:
- CP0 (after Agent A): frozen contracts + policy guardrail + platform primitives + tests
- CP1 (mid B/C): interface conformance note + failing/gap list (if any)
- CP2 (pre-merge): agent-level tests + wiki entries + risk notes
- CP3 (integrated): E2E validation evidence + degraded-mode verification + merge decision

## Verification Checklist (Per Agent + Integrated)

Per-agent verification (required):
- unit tests for owned logic
- failure-path tests for external/system dependencies
- audit/provenance coverage checks where applicable
- integration mode policy checks (where applicable)
- wiki doc entry created/updated if code changed

Integrated verification (required before declaring 3-agent run complete):
- P0 ticket flow works end-to-end via Cerebro + `Autotask`
- read-only enrichments appear in context panel/evidence surfaces without external mutations
- AI triage suggestions are recorded with confidence and audit provenance
- manager queue/SLA/audit visibility works for internal validation workflows
- retry/DLQ/reconciliation/degraded-mode behavior confirmed
- tenant scoping verified across API + worker + integration paths

Prompt-pack meta-acceptance (document quality checks):
1. All 14 required sections exist
2. All 3 prompts are P0-only and non-overlapping
3. Launch integration policy appears globally and is repeated inside each prompt
4. Agent A contract freeze is referenced as a dependency by Agents B and C
5. Each prompt includes acceptance criteria, tests/verification, wiki requirement, and do-not-do list
6. Merge order and conflict rules are explicit

## Done Criteria for the 3-Agent Run

This 3-agent run is complete only when:
- Agent A outputs (contract freeze + platform foundations) are merged and stable
- Agent B outputs (Autotask two-way + inbox workflow core) pass agent-level verification
- Agent C outputs (AI triage + read-only enrichments + manager ops P0) pass agent-level verification
- CP3 integrated verification passes (including degraded mode and tenant isolation checks)
- launch integration policy is preserved (`Autotask` two-way; all others read-only)
- required wiki documentation exists for all code changes produced by the agent run
- a final merge summary documents:
  - what shipped in P0
  - known gaps (if any)
  - follow-ups deferred to P1/P2
