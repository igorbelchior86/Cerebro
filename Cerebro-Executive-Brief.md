# Executive Brief (Strategy + Roadmap)
## Cerebro Expansion: MSP Service Delivery + Troubleshooting Intelligence

**Date:** February 2026  
**Version:** 1.0  

This document is for direction and decisions (why, what, when, risks).  
For product requirements, see: Product PRD.  
For delivery sequencing, architecture, and implementation details, see: Execution Guide.

---
# PRD Exec - Cerebro Expansion (MSP Service Delivery + Troubleshooting Intelligence)

**Date:** February 2026  
**Version:** 1.0  
**Status:** Executive Draft  
**Audience:** Founder, internal leadership, validation stakeholders

---

## 1. Vision

Cerebro is a service delivery and troubleshooting intelligence platform for MSPs.

The proposed expansion transforms Cerebro from a personal troubleshooting tool into an operational MSP service delivery platform, preserving critical service desk workflows and differentiating through resolution quality.

### Thesis
- Functional parity by critical workflow (no essential trade-offs)
- Differentiation in troubleshooting intelligence (context + hypothesis + handoff + learning)
- Initial execution on Refresh’s current suite of integrations: `Autotask + IT Glue + Ninja + SentinelOne + Check Point`

---

## 2. Current Phase (Strategy)

### Immediate objective
- Build and validate internally at Refresh
- Prove real operational value before external commercialization

### What we already have as a foundation
- Troubleshooting DNA (product origin)
- Initial integration suite for expansion: `Autotask + IT Glue + Ninja + SentinelOne + Check Point`
- Foundation for AI applied to triage, summarization, and technical assistance

---

## 3. Product Scope (Expansion)

### Launch scope (product)
- Unified inbox (chat/email)
- AI triage + assisted routing
- Technical/operational context (Autotask + IT Glue + Ninja + SentinelOne + Check Point)
- Handoff and escalation with AI summary
- Manager visibility (queue, SLA risk, AI/automation audit)

### Strategic differentiator (Cerebro)
- Troubleshooting intelligence embedded in the support workflow
- Better resolution quality, not just better dispatch
- Continuous learning from resolved incidents and runbooks

### Architecture Snapshot (Launch)
- **Control Plane (Cerebro App/API):** auth, tenant RBAC, inbox APIs, workflow orchestration, audit trail, feature flags
- **Execution Plane (Workers):** integration sync workers, enrichment workers, AI triage/assist workers, retry/DLQ processors
- **Data Plane:** PostgreSQL (tickets/audit/config), Redis (queues/cache), search/vector store (knowledge/context lookup), object storage (transcripts/attachments)
- **Integration Adapters:** `Autotask` (two-way), `IT Glue`/`Ninja`/`SentinelOne`/`Check Point` (read-only at launch)
- **Observability & Safety:** logs/metrics/traces, AI quality gates, HITL approvals, tenant-scoped rollout controls

---

## 4. Executive Backlog (P0 / P1 / P2)

### P0 - Commercially Sellable Launch (after internal validation)

#### Critical workflows
- Intake & Triage
- Dispatch & Routing
- Technician Context
- Handoff & Escalation
- Manager Visibility

#### Integrations
- `Autotask` (PSA core, **100% two-way / manageable via Cerebro at launch**)
- `IT Glue` (context/documentation, **read-only at launch**)
- `Ninja` (RMM alerts/device context, **read-only at launch**)
- `SentinelOne` (security/endpoint telemetry, **read-only at launch**)
- `Check Point` (security/network context, **read-only at launch**)

#### Platform
- Multi-tenant + RBAC
- Observability (logs/metrics/traces)
- Retry/DLQ/idempotency for integrations
- Per-tenant feature flags
- Audit trail for AI/automations

### P1 - Immediate Post-Launch Expansion
- Voice AI (initial phase)
- Two-way SMS
- Workflow builder v1
- ROI analytics v1.5
- Integrations: ConnectWise, HaloPSA
- Evolution of security integrations (assisted/HITL actions in SentinelOne and Check Point)

### P2 - Advanced Differentiation
- Controlled agentic workflows
- Troubleshooting graph / causal hints
- Predictive analytics
- Runbook generation/optimization loop
- RMM expansion and additional PSA/ITSM expansion

---

## 5. Milestones (Board-Level)

### What / When to Implement (Executive View)

#### Phase A — Foundation & Architecture (Weeks 1-2)
- Define domain boundaries, integration mode contracts (two-way vs read-only), event model, tenancy, and audit requirements
- Stand up baseline runtime (API, workers, queue, DB, observability, feature flags)

#### Phase B — P0 Core Workflow (Weeks 3-8)
- Build unified inbox, ticket lifecycle APIs, AI triage scaffolding, and Autotask two-way sync
- Add read-only enrichment from IT Glue, Ninja, SentinelOne, and Check Point
- Deliver technician context and handoff summary flow

#### Phase C — P0 Operational Readiness (Weeks 9-12)
- Manager visibility (queue/SLA/audit), AI quality gates + HITL, retry/DLQ/reconciliation, degraded-mode behavior
- Internal validation at Refresh with production-like data and operational runbooks

#### Phase D — Controlled Launch (Weeks 13-16)
- Fix validation gaps, harden onboarding, enable design partners via feature flags
- Maintain launch policy: `Autotask` two-way, all other integrations read-only

#### Phase E — P1 Expansion (Post-Launch, ~8-12 weeks)
- Voice AI (initial), two-way SMS, workflow builder v1, richer analytics
- ConnectWise/HaloPSA and assisted/HITL security actions

- **M1:** Internal validation at Refresh of the P0 workflows (Autotask + IT Glue + Ninja + SentinelOne + Check Point read-only, except Autotask two-way)
- **M2:** Controlled launch with design partners (full P0)
- **M3:** Expand channels/automation and prioritized integrations (P1)
- **M4:** Advanced differentiation in troubleshooting intelligence (early P2)

---

## 6. Key Risks

- Multi-integration synchronization complexity
- Quality/security of AI automations
- Operational adoption by technicians/managers
- Dependency on consistent onboarding and rollout

### Mitigations
- P0 scope focused on critical workflows
- Launch integration policy: `Autotask` two-way; all other integrations read-only
- AI quality gates + HITL + audit
- Progressive rollout with feature flags
- NFRs defined from the start (SLO, security, observability, fallback)

---

## 7. Execution Model

### Founder + AI Agents
- 1 founder/operator (product + engineering + validation)
- Specialized AI agents (coding, review, architecture, QA, docs)
- Iterative execution with automation of repetitive tasks and continuous documentation

---

## 8. Commercialization (Future)

- External commercialization is not the immediate focus
- Pricing and GTM remain future hypotheses after internal validation
- Historical commercialization references are documented in `PRD-Tech-EN-US.md`

---

## 9. Benchmark Reference

- Competitive benchmark (Thread) used only as a reference for parity by critical workflow
- Details and links are kept in the appendix of `PRD-Tech-EN-US.md`
