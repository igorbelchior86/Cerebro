# PRODUCT REQUIREMENTS DOCUMENT (PRD TECH)
## Cerebro: AI Service Delivery & Troubleshooting Platform for MSPs

**Creation Date:** February 2026  
**Version:** 1.0  
**Scope:** Product, architecture, technical execution, and operational requirements  
**Target Audience:** Founder, Product, Engineering, Tech Leads

---

## TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Product Overview](#product-overview)
3. [Value Proposition](#value-proposition)
4. [Technical Architecture](#technical-architecture)
5. [Core Features](#core-features)
6. [Pricing Models](#pricing-models)
7. [Integrations](#integrations)
8. [AI & Automations](#ai--automations)
9. [Roadmap & Future](#roadmap--future)
10. [Success Metrics](#success-metrics)
11. [Implementation Requirements](#implementation-requirements)

---

## EXECUTIVE SUMMARY

Cerebro is a **service delivery and troubleshooting intelligence platform for MSPs**. The product expansion combines modern support (chat, email, and voice), AI automation (triage, routing, categorization, technician assistant), and operational context from the MSP stack (**Autotask + IT Glue + Ninja + SentinelOne + Check Point**), focused on reducing time to resolution and operational overhead.

> **Expansion strategy (Cerebro):** the initial expansion is based on the integrations already available in the product (**Autotask + IT Glue + Ninja + SentinelOne + Check Point**). All other integrations enter as future roadmap. The goal is to reach **functional parity by critical workflow** with the market benchmark, not necessarily parity by an integration checklist on day 1.

### Key Stats
- **Technician Efficiency:** +35% (reduction in administrative time)
- **Automated Triage & Resolution:** 10-25% of tickets resolved without human intervention
- **Automation Accuracy:** 96% for categorization, priority, ticket type
- **ROI:** Guaranteed within 24-60 hours after onboarding
- **Integration Baseline (Cerebro Expansion):** Autotask (PSA), IT Glue (documentation), Ninja (RMM), SentinelOne (endpoint security), Check Point (network/perimeter security)

### Competitive Differentiators
1. **Conversation + PSA Integrated:** Eliminates duplicated interfaces
2. **Voice AI + Chat:** Omnichannel coverage (voice, chat, email, SMS)
3. **No Multi-Year Lock-in:** Month-to-month contracts
4. **Troubleshooting Intelligence:** Operational context + resolution-oriented AI
5. **Largest Conversational Dataset in the Industry:** Trained on real MSP ticket resolution

---

## PRODUCT OVERVIEW

### What is Cerebro?

Cerebro is a **service delivery and troubleshooting intelligence platform** that:

1. **Unifies Channels:** Chat (Teams, Slack, Web, Desktop) + Voice (Phone AI) + Email + SMS
2. **Automates Tickets:** AI performs triage, categorization, routing, and time-entry creation
3. **Integrates with PSA + MSP/Sec Stack:** Real-time sync (no manual refresh) + operational context (IT Glue / Ninja / SentinelOne / Check Point)
4. **Empowers Technicians:** Resolution suggestions, full context, customer history
5. **Measures ROI:** Built-in calculator, savings metrics, executive dashboard

### What we already have (Cerebro’s current base)

- Product rooted in real troubleshooting (founder workflow)
- Integrations already available for the initial expansion: **Autotask + IT Glue + Ninja + SentinelOne + Check Point**
- Ability to leverage technical/operational context as a support differentiator
- Foundation for AI applied to triage, summarization, and next-step recommendations

### What we want (fusion: current Cerebro + market benchmark)

- Deliver the critical service desk workflows expected by the market with no functional trade-offs
- Expand Cerebro from troubleshooting into a full MSP service delivery platform
- Differentiate via **troubleshooting intelligence**:
  - initial cause hypothesis
  - correlated context from assets/docs/alerts
  - high-quality technical handoff
  - continuous learning from resolved incidents
- Start with `Autotask + IT Glue + Ninja + SentinelOne + Check Point` and expand integrations as commercial demand requires

### User Segments

#### 1. **MSP Operators / Service Managers**
- Monitor tickets in real time
- See AI in action (automatic triage)
- Access ROI and capacity dashboards
- Configure custom workflows

#### 2. **Technicians / Support Engineers**
- Respond in native chat (Teams/Slack)
- See customer context via AI
- Use AI Chat (“Magic”) to draft responses
- Automatic time entries
- Ticket transfer with summary

#### 3. **End Users (MSP Customers)**
- Direct chat in Teams/Slack (no interface switching)
- Faster resolution (10-25% without technician involvement)
- Real-time updates
- “VIP” experience with instant response

#### 4. **Executives / C-Suite**
- ROI calculator & projections
- Capacity utilization metrics
- Savings forecast (FTE equivalent)
- Cost per ticket vs manual dispatch

---

## VALUE PROPOSITION

### For MSPs

#### Business Impact
| Metric | Impact | Formula |
|---------|--------|--------|
| **Administrative Time** | -30% to -35% | ~2 hours/tech/week reported |
| **Auto-Resolved Tickets** | +10-25% | No dispatch required |
| **Accuracy (Categorization)** | 96% vs ~70% manual | Better data quality → better reporting |
| **Time to First Response** | -80% | From email/phone to chat in seconds |
| **Customer Satisfaction** | +15-30% CSAT | Modern experience (Slack/Teams) |
| **Dispatch Overhead** | -100% | Tickets are pre-prepped by AI |
| **Revenue Reclamation** | +20-40% | ~2h/week/tech → 8-10 new clients/year |

#### Operational Benefits
1. **Eliminates Knowledge Silos:** Histories and resolutions captured automatically
2. **Modernizes the Interface:** Familiar (Slack/Discord), no extra training needed
3. **Scales Without Headcount:** +30% throughput with the same team
4. **Fast Implementation:** Go-live in 24-72 hours (vs 3-6 months for competitors)
5. **Automatic Compliance:** Built-in ITIL + data accuracy checks

### For End Customers
1. **24/7 Chat Support:** Where they work (Teams/Slack)
2. **Instant Resolution:** 10-25% with no delay (no waiting for a tech)
3. **Full Context:** Immediate history (no repeating the same info 3 times)
4. **Warm Handoff:** If a tech is needed, the ticket already includes all required info

### For Technicians
1. **Less Paperwork:** Automation for titles, categories, and time entries
2. **Better Collaboration:** Integrated chat + context + AI suggestions
3. **Focus on the “Magic”:** Less admin, more creative problem solving
4. **Mobile-Ready:** Respond to tickets from anywhere

---

## TECHNICAL ARCHITECTURE

### Tech Stack (Reference)

```
┌─────────────────────────────────────────────────────────────┐
│                    Cerebro Platform                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Presentation Layer (Multi-Channel)           │   │
│  │  ┌─────────┐ ┌─────────┐ ┌──────┐ ┌──────┐ ┌──────┐ │   │
│  │  │  Teams  │ │  Slack  │ │ Web  │ │Phone │ │Email │ │   │
│  │  └─────────┘ └─────────┘ └──────┘ └──────┘ └──────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
│                            ↓                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │       API Gateway & Message Queue                     │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │ WebSocket (real-time) + REST + gRPC + Webhooks │ │   │
│  │  │ Event-driven architecture (Kafka/RabbitMQ-like) │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
│                            ↓                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           AI & Automation Engine                      │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │   │
│  │  │  Triage AI   │ │   Magic AI   │ │  Voice AI    │ │   │
│  │  │  (LLM-based) │ │  (Assistant) │ │  (ASR+NLP)   │ │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ │   │
│  │                                                       │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │   │
│  │  │  Workflow    │ │  Sentiment   │ │  Contact     │ │   │
│  │  │  Engine      │ │  Analysis    │ │  Intelligence│ │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
│                            ↓                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         PSA Integration Layer (Real-time)             │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │   │
│  │  │ ConnectWise  │ │   Autotask   │ │   HaloPSA    │ │   │
│  │  │   (API)      │ │    (API)     │ │    (API)     │ │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
│                            ↓                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Data Layer & Knowledge Base                 │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │   │
│  │  │   Ticket DB  │ │  Knowledge   │ │   Customer   │   │
│  │  │ (PostgreSQL) │ │   Articles   │ │   Context    │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘   │
│  │                                                       │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │   │
│  │  │  Call/Chat   │ │  ML Models   │ │   Audit Log  │ │   │
│  │  │ Transcripts  │ │  & Vectors   │ │ & Compliance │ │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. **Presentation Layer (Multi-Channel)**
- **Teams Integration:** Native chat connector, bot commands (/, /assign, /resolve)
- **Slack Integration:** Workspace app + channel threading
- **Web Portal:** Dashboard for managers + mobile app
- **Voice AI:** Phone system integration (Asterisk-compatible)
- **Email Bridge:** Ingestion via API + outbound forwarding
- **Desktop App:** Electron-based (macOS/Windows) for standalone access

#### 2. **API Gateway & Message Queue**
- **WebSocket Server:** Real-time updates (tickets, assignments, responses)
- **REST API:** Standard CRUD + custom workflows
- **gRPC:** Performance-critical operations (transcoding, AI inference)
- **Event Streaming:** Kafka-like architecture for an event pipeline
- **Rate Limiting & Auth:** OAuth2 + API keys + tenant isolation

#### 3. **AI & Automation Engine**

##### 3a. **Triage AI**
- **LLM-Powered Classifier:** Analyzes ticket content
- **Outputs:** Title, Category, Priority, Type, Subtype, Recommended Resolution
- **Accuracy:** 96% vs 70% manual
- **Training Data:** Largest conversational dataset in MSP
- **Fine-Tuning:** ITIL + MSP-specific ticket history

**Triage Workflow:**
```
Customer Input (Chat/Email/Voice)
    ↓
Transcription (if voice) + Normalization
    ↓
LLM Analysis (Context: customer history, KB articles)
    ↓
Confidence Scoring
    ↓
Classification (title, category, priority, type)
    ↓
Auto-Create Ticket in PSA
    ↓
10-25% Self-Resolved (no dispatch)
    ↓
75-90% Routed + Assigned Automatically
```

##### 3b. **Magic AI (Technician Assistant)**
- **In-App AI Chat:** “Hey Magic, summarize this” / “Draft response for customer”
- **Capabilities:**
  - Draft customer responses
  - Confirm ticket details
  - Suggest next steps
  - Generate time entries
  - Summarize handoff for escalation
- **Context:** Access to customer history, KB, and current ticket

##### 3c. **Voice AI**
- **Instant Answering:** Automatic pickup (customizable hours)
- **Intelligent Routing:** Detects urgency in real time (P1 flags)
- **Call Transcription:** Speech-to-text + automatic gist
- **Warm Transfer:** To an available technician with full context
- **Phone System Agnostic:** Asterisk, Cisco, Avaya, generic SIP
- **Features:**
  - Live call monitoring (manager can listen/jump in)
  - Automatic sentiment detection
  - Multi-language transcription (optional)
  - Recording + archiving

##### 3d. **Contact Intelligence**
- **Caller Mapping:** Maps phone number → CRM contact (fuzzy matching)
- **Historical Context:** Last 5 tickets + resolution
- **Customer Profile:** Service tier, SLA, issue history
- **Risk Detection:** Angry customer? Escalate immediately

##### 3e. **Sentiment Analysis**
- **Real-Time Monitoring:** Detects frustration in chat/calls
- **Auto-Escalation:** If sentiment is negative, bump priority
- **Agent Coaching:** “Customer sounds upset, suggest resolution ASAP”

#### 4. **PSA Integration Layer**

##### Features
- **Native API Integration:**
  - ConnectWise Manage: Full REST API sync
  - Autotask: Webhooks + batch updates
  - HaloPSA: GraphQL + REST hybrid
- **Real-Time Sync:** No refresh required
- **Field Mapping:** Customizable per MSP (drag-and-drop)
- **Action Buttons:** /assign, /close, /escalate inside chat

##### Sync Flow
```
Cerebro AI Action (Auto-categorize, assign, etc.)
    ↓
Generate PSA Command
    ↓
Queue via Message Bus (idempotency key)
    ↓
Call PSA API (automatic OAuth2 token refresh)
    ↓
Retry Logic (exponential backoff)
    ↓
Webhook Confirmation
    ↓
Update Cerebro UI (real-time)
```

#### 5. **Data Layer & Knowledge Base**

##### Databases
- **Primary:** PostgreSQL (tickets, customers, interactions)
- **Vector DB:** Pinecone/Weaviate (embeddings for KB search)
- **Cache:** Redis (sessions, real-time counters)
- **Search:** Elasticsearch (full-text search on tickets + KB)
- **Time-Series:** InfluxDB (metrics, call duration, resolution time)

##### Knowledge Management
- **KB Ingestion:** Upload articles, auto-extract from resolved tickets
- **Semantic Search:** “How do I reset a password?” → matches relevant article
- **Auto-Linking:** AI suggests KB articles when creating a response
- **Version Control:** Track changes, rollback support

### Target Implementation Architecture (P0/P1)

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

## CORE FEATURES

### 1. **Inbox & Ticket Management**

#### 1.1 Unified Inbox (Familiar Interface)
- **Single Pane of Glass:** All tickets (Teams, Slack, Email, Voice, SMS)
- **Slash Commands:** /assign @tech, /close, /escalate, /snooze, /resolve
- **Priority View:** Visual flags (P1 red, P2 yellow, etc.)
- **Search & Filter:** “urgent AND customer=Acme AND category=Network”
- **Bulk Actions:** Select 10 tickets, bulk assign/close

#### 1.2 Ticket Auto-Population
- **Magic Fields:** Cerebro AI auto-fills:
  - Title (customer intent in one sentence)
  - Category (network, printing, email, etc.)
  - Priority (P1-P4 based on keywords + history)
  - Type & Subtype (Incident, Service Request, etc.)
  - Resolution Summary (if 10-25% auto-resolved)

#### 1.3 Customer Context View
- **Side Panel:** Shows complete customer profile:
  - Name, company, SLA level
  - Last 5 tickets + resolutions
  - Contact info (email, phone)
  - Known issues + workarounds
  - Current status (maintenance? migration?)

#### 1.4 Collaboration Features
- **@ Mentions:** @alice “Can you take this?” → ticket assigned
- **Internal Comments:** Notes not visible to the customer (vs public)
- **Conversational Threads:** Nested replies in chat (vs flat)
- **Emoji Reactions:** Ack, thumbs up, etc.
- **Pin Important Messages:** Keep reference links visible

### 2. **AI Automation Workflows**

#### 2.1 Pre-Built Workflows (Out of the Box)
- **Triage & Route:** Auto-assign based on skills + availability
- **Priority Escalation:** P1 detected → Slack alert + auto-assign senior tech
- **Auto-Categorize:** Email subject “Printer not working” → category=Hardware
- **Quick Resolve:** FAQ-matched issues → auto-response + close
- **Satisfaction Survey:** Post-resolution survey → feedback loop

#### 2.2 Custom Workflow Builder
- **No-Code Interface:** Drag-and-drop conditions + actions
- **Trigger Types:**
  - Ticket created
  - Status changed
  - Customer sentiment negative
  - Time-based (SLA approaching)
  - Manual (button click)

- **Actions:**
  - Create ticket
  - Assign to a specific tech/team
  - Update fields
  - Send notification (Teams/Slack/SMS)
  - Call external API (Zapier integration)
  - Escalate to manager

**Example Workflow:**
```
TRIGGER: Ticket created from NEW customer
CONDITION: Category = "Network" AND Priority > P3
ACTIONS:
  1. Assign to "Senior Network Team"
  2. Set SLA to "4-hour response"
  3. Send Teams message: "@Senior Network - New urgent network ticket"
  4. Add tag "manual-review"
```

#### 2.3 Auto Time Entry
- **Smart Capture:** Cerebro logs work with no manual input
- **Stopwatch Timer:** Start/stop integrated in chat
- **AI Estimation:** “This looks like a 30-minute task”
- **Compliance:** Auto-populated per ITIL + billable/internal flags
- **Accuracy:** 90%+ match to actual work done

### 3. **Voice AI**

#### 3.1 Instant Answering
- **Inbound:** Call comes in → AI picks up
- **Availability:** Customizable (9-5 Mon-Fri? 24/7?)
- **Greeting:** “Hi! You’ve reached [Company] support...”
- **IVR-like:** “Press 1 for billing, 2 for technical” (optional)

#### 3.2 Intelligent Call Routing
- **Detection:** “My invoice is wrong” → route to billing team
- **Availability Check:** “Tech team full? Queue customer.”
- **Skills-Based:** “Password reset” → junior tech available
- **Warm Transfer:** Never cold transfer
  - Brief senior tech: “Upset customer, billing issue, account #5432”
  - Customer stays on hold (music/info)
  - Warm intro: senior picks up with context

#### 3.3 Automatic Transcription & Logging
- **Real-Time:** Call happens, Cerebro shows the transcript live
- **Post-Call:** Full transcript attached to the ticket (searchable)
- **Gist Creation:** “Customer complained about latency. Rebooted server. Resolved.”
- **Summary:** Auto-creates or updates the ticket with key details

#### 3.4 Integration with PSA
- **Ticket Creation:** Call → automatic ticket creation
- **Field Population:** Duration logged, priority set, category assigned
- **Call Recording:** Stored as a ticket attachment (compliance)
- **Sentiment:** If negative, bump to P2

### 4. **Email & SMS Management**

#### 4.1 Email Integration
- **Inbound:** Emails parsed and used to create tickets automatically
- **Threading:** Replies grouped with the original ticket
- **Outbound:** Tech responds in Cerebro, auto-sends to the customer’s email
- **Attachment Handling:** Screenshots, logs uploaded to the ticket

#### 4.2 Two-Way SMS
- **Inbound:** Customer texts the support number
- **Outbound:** Tech can reply via SMS (not just auto-replies)
- **Real Conversations:** “Hi, we’re investigating. ETA 30 mins” → Customer “Thanks!”
- **Cost Optimization:** AI suggests SMS for simple updates (cheaper than calls)

### 5. **Real-Time Synchronization**

#### 5.1 PSA Integration (Native)
- **Two-Way Sync:** No refresh needed, ever
- **Conflict Resolution:** If a tech updates in the PSA, Cerebro reflects instantly
- **Field Mapping:** Customizable (drag-and-drop which fields sync)
- **Webhook Support:** PSA → Cerebro for status updates

**Sync Flow:**
```
Customer texts Cerebro
    ↓ (50ms)
AI processes, suggests category
    ↓ (200ms)
Create ticket call to PSA API
    ↓ (500ms-2s depending on PSA)
PSA webhook confirms → Cerebro shows ticket #
    ↓
Tech sees it in Cerebro inbox + PSA
```

#### 5.2 Latency Guarantees
- **<100ms:** Local updates (UI, cache)
- **<2s:** PSA round-trip (including API)
- **Retry Logic:** Exponential backoff, max 5 retries

### 6. **Knowledge Management**

#### 6.1 Article Management
- **Import Sources:**
  - Uploaded Markdown files
  - Confluence/SharePoint (auto-sync)
  - Jira knowledge base
  - PDF documents (OCR + parsing)
- **Tagging:** AI auto-tags (category, keyword)
- **Search:** Full-text + semantic search

#### 6.2 Auto-Linking to Tickets
- **Smart Suggestion:** Ticket “Printer issue” → suggests KB articles
- **One-Click Insert:** Tech clicks → response text auto-populated
- **AI Refinement:** Customize before sending to customer

#### 6.3 Learning Loop
- **Resolved Tickets as KB:** “Reset password” ticket → auto-create a KB article
- **Continuous Improvement:** New categories discovered → new articles suggested

### 7. **Analytics & Reporting**

#### 7.1 Executive Dashboard
- **ROI Calculator:** “You saved $X by preventing Y hours of admin”
- **Ticket Metrics:**
  - Total volume
  - Average resolution time
  - AI auto-resolved rate (%)
  - Customer satisfaction (CSAT)
- **Capacity Utilization:** Current tickets/tech, forecasted load
- **Cost per Ticket:** Manual vs AI-assisted vs auto-resolved

#### 7.2 Technician Performance
- **Productivity Metrics:** Tickets closed/day, avg resolution time
- **AI Usage:** % of tickets with AI assistance
- **Response Times:** First response, resolution
- **CSAT by Tech:** Quality indicator

#### 7.3 Custom Reports
- **By Customer:** Ticket trend, SLA compliance, resolution rate
- **By Category:** Most common issues, resolution patterns
- **Time Period:** Weekly/monthly/quarterly trends
- **Export:** CSV, PDF, scheduled email

### 8. **Security & Compliance**

#### 8.1 Authentication & Authorization
- **OAuth2:** Standard enterprise auth (Azure AD, Okta, Google)
- **RBAC:** Role-based access (Admin, Manager, Tech, Viewer)
- **Audit Trail:** All actions logged (who, what, when)
- **2FA:** Optional enforcement at org level

#### 8.2 Data Protection
- **Encryption:** TLS 1.3 in transit, AES-256 at rest
- **Data Residency:** Customizable (US, EU, etc.)
- **GDPR Compliance:** Right to deletion, data export
- **HIPAA/FISMA:** Enterprise certifications available

#### 8.3 Call Recording Compliance
- **Automatic Disclosure:** “This call may be recorded” with customer consent
- **Secure Storage:** Encrypted, access-controlled
- **Retention:** Customizable policy (30 days, 1 year, etc.)
- **Archival:** Move to cold storage after X days

### 9. **Admin & Setup**

#### 9.1 Initial Configuration
- **PSA Selection:** Choose ConnectWise / Autotask / HaloPSA
- **Channel Setup:** Connect Teams/Slack/Email/Phone
- **Team Structure:** Define groups, assign skills
- **Workflow Defaults:** Category mapping, priority rules, SLA templates

#### 9.2 Onboarding
- **Quick Start Checklist:**
  - [ ] Connect PSA (OAuth2)
  - [ ] Add Teams bot
  - [ ] Define team structure
  - [ ] Set up voice (forward phone #)
  - [ ] Import KB articles
  - [ ] Configure 2-3 key workflows
  - **Total Time:** ~2 hours (guided)

#### 9.3 Tenant Isolation
- **Multi-Tenant Architecture:** Multiple MSPs on the same instance
- **Data Walls:** Strict isolation between orgs
- **Custom Branding:** Logo, colors per organization
- **White-Label:** Available at higher tier

---

## PRICING MODELS
### Scope note (current phase)

Sales/commercial content (pricing, GTM, contract model, and commercial strategy) was consolidated into the final section:

- `## FUTURE COMMERCIALIZATION (Consolidated)`

At this phase, the focus is development and internal validation at Refresh.

---

## INTEGRATIONS

### Integration Policy (Initial Launch)

- **Autotask:** **100% two-way** integration and fully manageable by Cerebro at initial launch (create, update, route, and manage tickets/time entries within the defined scope)
- **IT Glue / Ninja / SentinelOne / Check Point:** **read-only** integrations at initial launch for context, correlation, and ticket enrichment
- **Post-launch evolution:** assisted/HITL actions in read-only integrations only after operational validation, auditing, and tenant guardrails

### PSA (Primary, Cerebro Expansion Baseline)

#### Autotask (Launch Baseline)
- **API:** GraphQL + REST hybrid
- **Sync Scope (Phase 1):** Tickets, Companies, Contacts, Time Entries (**100% two-way via Cerebro**)
- **Webhooks/Polling:** Real-time when available + resilient polling fallback
- **Authentication:** OAuth/API credentials with secure rotation
- **Custom Fields:** Mappable in UI (prioritize triage/dispatch critical fields)
- **Rate Limits:** Respected with backoff + per-tenant queues

**Integrations Roadmap:**
```
Phase 1 (Cerebro Expansion - Initial Commercial Launch):
✅ Autotask (PSA) - primary ticketing system (100% two-way)
✅ IT Glue - documentation/context enrichment (read-only)
✅ Ninja - RMM events/device context (read-only)
✅ SentinelOne - endpoint/security context (read-only)
✅ Check Point - network/perimeter context (read-only)

Phase 2 (Next Integrations):
🔄 ConnectWise Manage
🔄 HaloPSA
🔄 SMS provider(s) for two-way messaging

Phase 3 (Broader PSA/ITSM):
📋 Datto PSA / Kaseya BMS
📋 Jira Service Management
📋 FreshService / Zendesk
```

#### Future PSA Integrations (Roadmap)
- **ConnectWise Manage:** high priority due to MSP market share
- **HaloPSA:** regional/segment priority (UK/EU)
- **Other ITSM/PSA:** based on commercial demand and feasibility of real-time sync

### Communication Platforms

#### Microsoft Teams
- **Bot:** Native Teams bot (slash commands)
- **Messaging:** Rich formatting, adaptive cards
- **Files:** Auto-attach tickets to Teams messages
- **Status:** Show agent status (available, in call, etc.)
- **Deep Link:** Click notification → jump to ticket

#### Slack
- **App:** Public marketplace app
- **Channels:** Dedicated channels (one per customer or category)
- **Workflows:** Native Slack workflow builder integration
- **Threads:** Nested replies for clean UI
- **Status:** 🟢 Available, 🔴 Busy, etc.

#### Email
- **IMAP/POP3:** Email forwarding + ingestion
- **SMTP:** Outbound via Cerebro
- **Threading:** Replies grouped with the original ticket
- **Attachment Handling:** Screenshots, logs, PDFs

#### Voice / Telephony
- **SIP:** Standard SIP integration (any provider)
- **PBX Systems:**
  - Asterisk (open source)
  - Cisco UCM
  - Avaya
  - Microsoft Teams Phone
  - Vonage Nexmo
- **Forwarding:** Forward main number to a Cerebro number
- **IVR Integration:** Optional button-press routing

### Third-Party Tools

#### RMM (Remote Monitoring & Management)
- **Ninja (Launch Baseline):** device alerts/events → ticket creation/enrichment
- **Ninja Device Context:** endpoint, status, last seen, alert severity in the side panel
- **Ninja Workflows:** trigger automations from events/alerts
- **Kaseya / N-able / ConnectWise Automate:** future roadmap

#### Security Platforms
- **SentinelOne (Launch Baseline, read-only):** alerts/incidents/device security context for triage and handoff
- **SentinelOne Context Enrichment:** severity, endpoint status, detection timeline/storyline, relevant indicators
- **Check Point (Launch Baseline, read-only):** firewall/VPN/network security context for troubleshooting and correlation
- **Check Point Context Enrichment:** events, relevant objects/policies, block/deny signals (when available)
- **Security actions (quarantine/policy changes/etc.):** post-launch roadmap with mandatory HITL

#### Ticketing & Workflows
- **Zapier:** inbound webhooks for custom integrations
- **Make (Integromat):** workflow builder
- **Custom API:** REST endpoints for partners

#### Knowledge Management
- **IT Glue (Launch Baseline):** documentation, runbooks, configs, assets and credentials (metadata-only where applicable)
- **IT Glue Context Enrichment:** auto-link by customer/site/device for triage/resolution
- **Confluence / SharePoint / Jira / Notion:** future roadmap

#### CRM
- **HubSpot:** contact sync
- **Salesforce:** custom connector available

---

## AI & AUTOMATIONS

### AI Models & Training

#### 1. **Triage Engine**
- **Base Model:** Proprietary fine-tuned model trained on 10M+ resolved MSP tickets
- **Input:** Customer message (chat/email/voice transcript)
- **Outputs:**
  ```json
  {
    "title": "VPN Connection Failed",
    "category": "Network",
    "priority": "P2",
    "type": "Incident",
    "subtype": "Connectivity",
    "resolution_confidence": 0.85,
    "suggested_resolution": "Check VPN certificate expiry"
  }
  ```
- **Accuracy:** 96% vs 70% manual
- **Latency:** <500ms (P95)
- **Retraining:** Continuous (new resolved tickets feed the model)

#### 2. **Contact Intelligence**
- **Caller Mapping:** Phone number → contact record (fuzzy matching)
- **Historical Context:** Last 5 tickets + outcomes
- **Customer Risk Profile:** “Angry repeat caller” → escalate
- **Accuracy:** 94% match rate

#### 3. **Sentiment Analysis**
- **Real-Time:** Analyzed during chat/call
- **Triggers:**
  - Negative → bump priority, escalate
  - Angry profanity → queue alert
  - Very happy → offer upsell after resolution
- **Languages:** English, Spanish, French (extensible)

#### 4. **Speech Recognition (Voice AI)**
- **STT (Speech-to-Text):** ~95% accuracy
- **Supported Languages:** English (primary), Spanish, French (planned)
- **Speaker Identification:** Tech vs Customer (diarization)
- **Real-Time:** Live transcription (not post-call only)
- **Latency:** <2 seconds per sentence completion

#### 5. **Entity Extraction**
- **Detect:**
  - Customer names / company names
  - IP addresses / hostnames
  - URLs / file paths
  - Error codes / stack traces
  - Phone numbers (for privacy redaction)
- **Confidence Scoring:** Only extract when confidence is high

### Automation Workflows (Pre-Built)

#### Workflow: “Network Down - Auto-Escalate”
```
TRIGGER: Email received with subject containing "network", "down", "outage"
CONDITIONS:
  - Priority matches "Critical" OR "Urgent"
  - Category = "Network"
  - Time = business hours
ACTIONS:
  1. Auto-create ticket
  2. Set priority = P1
  3. Notify senior network team in Slack
  4. Start Voice AI to field inbound calls
  5. Set SLA = 1 hour
  6. Add tag "incident-response"
```

#### Workflow: “FAQ Match - Auto-Resolve”
```
TRIGGER: Ticket created
CONDITION: Ticket text matches KB article with >90% confidence
ACTIONS:
  1. Extract matching KB article
  2. Auto-compose response to customer
  3. Send response
  4. Mark ticket as resolved
  5. Schedule 30-day follow-up check
STATS: Resolves ~15-20% of common issues
```

#### Workflow: “New Customer Onboarding”
```
TRIGGER: New company added to PSA
CONDITIONS:
  - Managed Service agreement signed
  - Service level = "Premium"
ACTIONS:
  1. Create "Onboarding Checklist" ticket
  2. Assign to Account Manager
  3. Trigger email: "Welcome to [MSP], here's your setup..."
  4. Send access credentials
  5. Schedule kickoff call (Teams)
  6. Add to automated health check routine
```

### Human-in-the-Loop Patterns

#### Pattern 1: “Suggest, Then Ask”
```
AI detects: "Ticket seems critical but low confidence on category"
Action: Show to manager + suggestion
Manager: Clicks 👍 or ⏳ "Wait for more info"
Outcome: Ticket routed per manager decision
```

#### Pattern 2: “Escalation Handoff”
```
Technician working on a ticket
AI monitors: "This is getting complex, senior needed"
Action: AI suggests escalation to senior team
Tech: Clicks "Escalate" + AI drafts summary
Senior: Receives a prepped ticket with full context
```

#### Pattern 3: “Quality Review”
```
AI auto-resolves 100 tickets
Sampling: QA team reviews a random 5 for accuracy
If any fails: Feedback → model retraining
Continuous improvement loop
```

---

## ROADMAP & FUTURE

### Phase 1: Current (Live Now, Feb 2026)
✅ Unified Inbox (Teams, Slack, Web)  
✅ Triage AI + Auto-Categorization  
✅ Voice AI (instant answering)  
✅ Baseline Cerebro Expansion Integrations (Autotask, IT Glue, Ninja)  
✅ Workflows (pre-built + custom)  
✅ Email integration  
✅ Time entry automation  

### Phase 2: Near-Term (Q2-Q3 2026)
🔄 **Two-Way SMS** (in progress)  
🔄 **Sentiment Analysis** (rolling out)  
🔄 **Lemma AI Orchestration Platform** (composable workflows)  
🔄 **ConnectWise / HaloPSA Integrations** (expand PSA coverage)  
🔄 **AI Agent Team** (create custom agents)  

### Phase 3: Medium-Term (Q4 2026 - Q1 2027)
📋 **RMM Expansion** (Kaseya, N-able, others)  
📋 **Advanced Workflows** (state machines, branching logic)  
📋 **Predictive Analytics** (forecast ticket load 2 weeks out)  
📋 **Knowledge Graph** (auto-connect related tickets)  
📋 **Feedback Loop Optimization** (post-resolution customer surveys)  

### Phase 4: Long-Term Vision (2027+)
🎯 **Fully Agentic Team:**
- AI agents that act like human technicians
- Learn infrastructure specifics (DNS, DKIM, etc.)
- Collaborate with other agents
- Escalate only when necessary

🎯 **Mission-Critical AI Orchestration** (Lemma Platform):
- Compose workflows across 100+ systems
- Native security & governance
- Enterprise-grade reliability (99.99% uptime SLAs)

🎯 **Predictive Maintenance:**
- “Your VPN cert expires in 7 days” → auto-renewal ticket
- “Server CPU trending up” → suggest upgrade

---

## SUCCESS METRICS

### For MSPs

| Metric | Baseline | Target (6 mo) | Measurement |
|---------|----------|---------------|-------------|
| **Ticket Resolution Time** | 4 hours | 2 hours | Avg close time |
| **Technician Admin Time** | 40% | 10% | Time tracking logs |
| **AI Auto-Resolution Rate** | 0% | 15-20% | No-dispatch tickets |
| **CSAT Score** | 75 | 88+ | Post-ticket survey |
| **Dispatch Overhead** | 100% | 0% | Manual routing required |
| **Capacity Utilization** | 70% | 95% | Tickets/tech/day |
| **Cost per Ticket** | $45 | $12 | Admin cost amortized |

### For End Customers

| Metric | Impact |
|---------|--------|
| **First Response Time** | -80% (email 4 hrs → chat 5 min) |
| **Resolution Time** | -50% (avg 2 days → 1 day) |
| **24/7 Availability** | ✅ Voice AI handles after-hours |
| **Self-Service Rate** | +25% (AI suggests KB articles) |

### For the Cerebro Business

| Metric | Focus |
|---------|------|
| **NPS Score** | >60 (SaaS benchmark: 50) |
| **Customer Retention** | >95% (sticky due to ROI guarantee) |
| **ARR Growth** | 150%+ YoY |
| **Time-to-Value** | <24 hours (go-live to first ticket) |

---

## IMPLEMENTATION REQUIREMENTS

### To Build a Similar Product

#### Recommended Tech Stack

```
Frontend:
- React 18+ / Next.js (web UI)
- React Native or Flutter (mobile)
- Electron (desktop app)
- WebSocket client (real-time updates)

Backend:
- Node.js/Express OR Python/FastAPI (API server)
- PostgreSQL (primary DB)
- Redis (cache + sessions)
- Elasticsearch (search)
- Kafka/RabbitMQ (event streaming)

AI/ML:
- OpenAI API / Claude API (LLM triage)
- Anthropic Claude (fine-tuning via API)
- Sentence Transformers (embeddings)
- Pinecone / Weaviate (vector DB for KB)
- Deepgram / Twilio (speech-to-text)
- TensorFlow / PyTorch (sentiment analysis)

Infrastructure:
- Kubernetes (container orchestration)
- Docker (containerization)
- AWS / GCP / Azure (cloud hosting)
- Terraform (IaC)
- GitHub Actions (CI/CD)

Monitoring:
- DataDog / New Relic (APM)
- Sentry (error tracking)
- ELK Stack (logging)
- Prometheus (metrics)
```

### Implementation Plan (What / When)

This plan translates the architecture into execution order. It is optimized for the actual execution model (`Founder + AI Agents`) and for internal validation at Refresh before commercialization.

#### Planning Assumptions
- One primary human operator (founder) with AI agents for implementation, review, QA, and documentation
- P0 objective is internal validation + launch readiness, not broad feature breadth
- `Autotask` is the only P0 two-way integration; all other P0 integrations are read-only
- Weekly planning cadence with milestone reviews every 2 weeks

#### Workstreams (What)

##### WS-A. Platform Foundations
- tenant model + RBAC
- API/worker split + queue runtime
- observability baseline (logs/metrics/traces)
- feature flags + audit trail
- integration credential management

##### WS-B. Autotask Two-Way Core
- command model (create/update/assign/status/time entries)
- sync ingestion (webhook/polling)
- reconciliation + idempotency
- error handling + retry/DLQ

##### WS-C. Inbox & Workflow Core
- unified inbox (chat/email)
- ticket command UX
- internal/public comments
- routing rules and assignment workflow

##### WS-D. AI Triage + Assist
- triage inference pipeline
- confidence scores + rationale/provenance
- policy gates + HITL
- AI summary/handoff drafting

##### WS-E. Read-Only Context Enrichment
- IT Glue context cards
- Ninja alert/device enrichment
- SentinelOne alert/incident/endpoint enrichment
- Check Point perimeter/network/security enrichment

##### WS-F. Manager Visibility + Ops Readiness
- queue/SLA dashboard
- automation/AI audit views
- runbooks for degraded mode and reconciliation
- validation instrumentation and QA sampling workflows

#### Sequence (When)

##### Phase 0 — Architecture & Foundations (Weeks 1-2)
**Primary goal:** establish runtime contracts and delivery scaffolding

- WS-A baseline implementation
- adapter interface contract for all integrations
- canonical ticket/context/audit schemas
- Autotask command boundaries (explicitly scoped two-way operations)
- launch policy enforcement mechanism (two-way vs read-only)

**Exit criteria**
- API + worker runtime operational
- queue/retry/DLQ skeleton working
- tenant scoping and audit hooks in place
- integration mode policy testable end-to-end

##### Phase 1 — P0 Workflow Skeleton (Weeks 3-5)
**Primary goal:** end-to-end ticket flow with Autotask two-way backbone

- WS-B core Autotask command + sync paths
- WS-C inbox MVP (chat/email + ticket commands)
- WS-D basic AI triage pipeline (suggestion-first)

**Exit criteria**
- create/update/assign in Autotask works through Cerebro
- inbox reflects Autotask state changes reliably
- audit records created for commands and AI suggestions

##### Phase 2 — Context Enrichment & Handoff (Weeks 6-8)
**Primary goal:** deliver Cerebro’s troubleshooting differentiation in P0

- WS-E read-only enrichments (IT Glue, Ninja, SentinelOne, Check Point)
- WS-D AI summary/handoff drafting with enriched context
- WS-C technician context panel + handoff flows

**Exit criteria**
- ticket context panel shows multi-source enrichment
- no write actions issued to read-only integrations
- handoff summary uses enriched evidence/provenance

##### Phase 3 — Manager Visibility, Controls, and Hardening (Weeks 9-11)
**Primary goal:** operational trust and internal validation readiness

- WS-F dashboards/audit views
- WS-D confidence thresholds + HITL enforcement
- WS-B/WS-E reconciliation, retries, degraded mode hardening

**Exit criteria**
- queue/SLA/audit visibility available
- AI quality gates active and observable
- reconciliation jobs and degraded-mode runbooks tested

##### Phase 4 — Refresh Internal Validation (Weeks 12-14)
**Primary goal:** validate with real workflows and identify gaps before external launch

- production-like usage with Refresh operators/technicians
- issue triage backlog + fixes
- measurement against P0 success criteria (speed, data quality, usability)

**Exit criteria**
- P0 workflow acceptance criteria met
- critical bugs closed
- launch/no-launch decision documented

##### Phase 5 — Controlled Design-Partner Launch (Weeks 15-18)
**Primary goal:** limited external rollout with guardrails

- per-tenant feature-flag rollout
- onboarding hardening
- support/playbooks for operational incidents

**Exit criteria**
- at least one stable design-partner cohort
- acceptable operational load for founder + AI agents model
- prioritized P1 backlog validated by real usage

#### Dependency Notes (Critical Path)
- WS-B (Autotask two-way) depends on WS-A foundations and adapter contract
- WS-D (AI policy gates) depends on audit trail and workflow command model
- WS-E enrichments depend on credential/tenant policy infrastructure
- WS-F dashboards depend on reliable audit and event telemetry

#### Resourcing Model (Execution Reality)
- **Founder:** architecture decisions, implementation orchestration, final reviews, operational validation
- **AI Agents:** code generation, refactors, test generation, documentation updates, review support, checklists
- **Rule:** optimize for narrow-but-deep progress by milestone, not parallel feature sprawl

### Parity Matrix (Market Benchmark) by Persona and Critical Workflow

Goal: ensure Cerebro competes without perceived trade-offs in essential MSP workflows.

| Persona | Critical Workflow | Market Baseline (Expected) | Cerebro Minimum Parity (Launch) | Acceptance Criteria |
|---------|-------------------|----------------------------|----------------------------------|--------------------|
| **Service Manager / Dispatcher** | Triage + initial routing | Unified inbox, AI categorization, priority, assignment | Unified inbox + AI triage + assign in Autotask + routing rules | Ticket created with correct minimum fields + assigned in <2 min |
| **Service Manager / Dispatcher** | Operational visibility | Queue, SLA, status, alerts | Basic queue/SLA dashboard + priority alerts + audit trail | Manager identifies backlog/SLA risk without opening PSA |
| **Technician** | Support and resolution | Respond in chat, customer context, history, AI assist | Respond in channel + Autotask/IT Glue/Ninja/SentinelOne/Check Point context + AI drafting/summarization | Tech resolves without switching screens to fetch critical context |
| **Technician** | Handoff / escalation | Auto summary, internal comments, reassign | AI summary + internal comments + reassign + escalation tag | Senior receives a ready context packet with no rework |
| **End User** | Open and track | Familiar channel, fast updates, threading | Open via chat/email + updates + basic threading | User gets confirmation + clear status quickly |
| **Executive / MSP Owner** | Proof of ROI | Savings metrics, throughput, auto-resolve | Initial ROI dashboard (admin time, TFR, auto-triage, throughput) | Value is perceived within 30-60 days |

### Differentiation Matrix (More Value Without Losing Parity)

Goal: compete on the market benchmark baseline while owning native troubleshooting advantage.

| Theme | Mandatory Parity | Cerebro Differentiator | Competitive Benefit |
|------|-------------------|------------------------|---------------------|
| **Triage** | categorization/priority/routing | troubleshooting-oriented triage (initial hypothesis + next steps) | less ping-pong and faster resolution |
| **Context** | ticket/customer history | unified operational context (Autotask + IT Glue + Ninja + SentinelOne + Check Point) per ticket/device/site | tech gets actionable context, not just history |
| **Handoff** | summary and reassign | evidence-based handoff with recent changes and correlated alerts | faster escalation with less context loss |
| **Knowledge** | KB suggestion | runbook generation from resolved incidents + asset/customer linking | cumulative learning focused on execution |
| **Ops Control** | no-code workflows | automation simulation/dry-run + policy gates per tenant | safer adoption for conservative MSPs |
| **Analytics** | service desk KPIs | troubleshooting metrics (MTTH, rework, repeat incident, likely cause) | proof of value beyond dispatch/admin |

### Commercially Sellable MVP (Not Just Technical)

Goal: ship something an MSP will pay for, with measurable value and controlled rollout.

#### Commercial MVP, Required Scope (Launch)

1. **Unified Inbox (Chat + Email)**
   - basic threading
   - assign/reassign
   - internal vs public comments
2. **Autotask Native Integration (Core)**
   - ticket create/update/sync (**100% two-way at launch**)
   - minimal contacts/companies sync
   - assisted time entry (manual + AI suggestion)
3. **IT Glue Context Enrichment**
   - **read-only at launch**
   - contextual lookup by customer/site/device
   - relevant links and suggested runbooks/docs
4. **Ninja Event + Device Context**
   - **read-only at launch**
   - ingest alerts for ticket creation/enrichment
   - side panel with device status/related alerts
5. **Security Context (SentinelOne + Check Point)**
   - **read-only at launch**
   - ingest/lookup alerts/incidents and endpoint/perimeter context
   - relevant signals for triage, priority, and technical handoff
6. **AI Triage + AI Assist**
   - title/category/priority/type suggestions with confidence
   - summary/handoff draft
   - KB/runbook suggestion
7. **Manager Visibility**
   - basic queue/SLA dashboard
   - audit view of automations and AI suggestions
8. **Operational Readiness**
   - guided onboarding for Autotask + IT Glue + Ninja + SentinelOne + Check Point
   - rollback/fallback to manual operation

#### Commercial MVP, Out of Launch (Roadmap)
- Full Voice AI
- Two-way SMS
- Multi-PSA (ConnectWise, HaloPSA, etc.)
- Advanced workflow builder (state machine/branching)
- Agentic execution/autonomous remediation

### Non-Functional Requirements (NFRs)

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

### Execution PRD (Prioritized Backlog P0 / P1 / P2)

Goal: translate strategy into an executable backlog by workflow and by integration, preserving commercial focus for launch.

#### P0 (Must Ship, Commercial Launch)

##### Critical Workflows
- **F0. Intake & Triage:** unified inbox (chat/email), ticket create/update, AI triage with confidence and human review
- **F1. Dispatch & Routing:** assign/reassign, priority, internal comments, routing rules
- **F2. Technician Context:** side panel with customer/ticket/device/docs/security context (Autotask + IT Glue + Ninja + SentinelOne + Check Point)
- **F3. Handoff & Escalation:** AI summary, escalation tag, recent history and correlated alerts
- **F4. Manager Visibility:** queue, SLA risk, audit of automations/AI suggestions

##### Integrations (Launch)
- **Autotask (P0):** ticket CRUD/sync, contacts/companies, assisted time entries, basic reconciliation (**100% two-way / manageable via Cerebro**)
- **IT Glue (P0):** contextual lookup by customer/site/device, suggested links/runbooks, cache and per-tenant permissions (**read-only**)
- **Ninja (P0):** alert ingestion, correlation by device/customer, ticket enrichment, device status (**read-only**)
- **SentinelOne (P0):** ingest/lookup alerts/incidents and endpoint/security context for triage/handoff (**read-only**)
- **Check Point (P0):** lookup/ingest perimeter/network/security context for troubleshooting (**read-only**)

##### Platform / Operations (P0)
- **Tenant isolation + RBAC**
- **Observability (correlated logs/metrics/traces)**
- **Retry/DLQ/idempotency for integrations**
- **Per-tenant feature flags**
- **Audit trail for AI and automation decisions**

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
- **Troubleshooting graph / causal hints**
- **Predictive analytics** (repeat incidents, SLA risk, forecasting)
- **Runbook generation & optimization loop**

##### Integrations
- **RMM expansion** (Kaseya, N-able, etc.)
- **PSA/ITSM expansion** (Jira SM, Freshservice, Zendesk, etc.)

### Investor / Board Readability (Executive Version of the PRD)

Goal: summarize product thesis, execution, and risk in a fast-read format for leadership/investors.

#### 1. Problem
- MSPs operate with high administrative costs, inconsistent manual triage, and fragmented context across PSA, documentation, and RMM.

#### 2. Solution (Cerebro)
- A service delivery + troubleshooting intelligence platform for MSPs, starting with the stack `Autotask + IT Glue + Ninja + SentinelOne + Check Point`.

#### 3. Differentiator
- Beyond dispatch/triage, Cerebro improves **resolution quality** via operational context and troubleshooting-oriented AI.

#### 4. Go-To-Market Entry Strategy
- Functional parity on critical service desk workflows (no essential trade-off)
- MSP design partners using the stack `Autotask + IT Glue + Ninja + SentinelOne + Check Point`
- ROI proof in 30-60 days via operational metrics

#### 5. Key Risks
- Multi-system integration/synchronization complexity
- Quality and security of AI automations
- Operational adoption by technicians/managers
- Dependency on onboarding and well-executed rollout

#### 6. Mitigations
- P0 scope focused on critical workflows
- AI quality gates + HITL + continuous auditing
- Per-tenant feature flags + progressive rollout
- NFRs and observability defined from launch

#### 7. Milestones (Board-Level)
- **M1:** Commercial launch with Autotask (two-way) + IT Glue/Ninja/SentinelOne/Check Point (read-only) (P0)
- **M2:** Channel/automation expansion and dashboards (P1)
- **M3:** Integration expansion (ConnectWise/Halo) + troubleshooting differentiation (early P2)
- **M4:** Consolidate competitive advantage in resolution/advanced automation

### Delivery Timeline Summary (Founder + AI Agents)

This timeline summarizes the detailed implementation plan above in a compact format for ongoing tracking.

#### P0 (Internal Validation + Launch Readiness): ~14-18 weeks
- Weeks 1-2: Architecture/foundations (runtime, queue, audit, policy contracts)
- Weeks 3-5: Autotask two-way + inbox workflow skeleton
- Weeks 6-8: Read-only enrichments (IT Glue/Ninja/SentinelOne/Check Point) + handoff differentiation
- Weeks 9-11: Manager visibility, AI controls, hardening
- Weeks 12-14: Refresh internal validation
- Weeks 15-18: Controlled design-partner launch (if validation gates pass)

#### P1 (Post-Launch Expansion): ~8-12 weeks
- Voice AI (initial phase)
- Two-way SMS
- Workflow builder v1
- ROI analytics v1.5
- ConnectWise/HaloPSA
- Assisted/HITL security actions (SentinelOne/Check Point)

#### P2 (Advanced Differentiation): ongoing (sequenced by validation and demand)
- Controlled agentic workflows
- Troubleshooting graph / causal hints
- Predictive analytics
- Runbook optimization loop
- Broader PSA/RMM/ITSM expansion

### Planning Range (Reality-Based)
- **P0 internal validation + launch readiness:** ~3.5 to 4.5 months
- **P1 expansion after launch:** +2 to 3 months
- **Feature parity + differentiated baseline:** ~6 to 9 months (execution-quality dependent)

---

## SUMMARY & NEXT STEPS

### Next steps for Cerebro expansion:

1. **Start with the MVP:** inbox + 1 PSA integration + basic AI triage
   - Validate PMF with 3-5 beta MSP customers
   - Measure: can they achieve ROI in 30-60 days?

2. **Operating Model (Founder + AI Agents):**
   - 1 founder/operator (product + engineering + validation)
   - Specialized AI agents (coding, review, architecture, QA, docs)
   - Iterative execution with automation of repetitive tasks and continuous documentation

3. **Technology Priorities:**
   - Real-time sync (WebSocket + event streaming are essential)
   - API-first (to support multiple PSAs)
   - Multi-tenancy (key for SaaS economics)
   - Security from day 1 (encryption, auth, audit logs)

4. **Commercialization (Future):**
   - Content consolidated in the final section of this document

### Expected Timeline:
- MVP → Market: **4-6 months**
- Break-even: **12-18 months** (depending on sales velocity)
- Market leadership: **3-5 years** (if execution is strong + funding is adequate)

---

## FUTURE COMMERCIALIZATION (Consolidated)

> This section consolidates commercialization hypotheses for future use. Right now, the focus is **build and validate internally at Refresh**. This is not an immediate execution plan.

### Principles for this phase
- Current priority: product, internal operational validation, and proof of real value
- External commercialization: future phase, after validation of critical workflows and operational quality
- Pricing below: **chronological/historical reference** of hypotheses, not a current decision

### Pricing (Chronological / Historical Reference)

#### Service Tiers (future hypothesis)

##### Tier 1: AI Essentials
**$19 / managed customer / month**

##### Tier 2: AI Pro (future hypothesis)
**$34 / managed customer / month + $800 (one-time setup)**

##### Add-ons (future hypothesis)
- **Integrated Chat:** +$5/customer/month
- **Voice AI:** +$15/customer/month
- **AI Ticket Credits:** $0.50/credit

#### Volume Example (historical reference)

| Component | Quantity | Unit Price | Monthly Total |
|-----------|----------|-----------|---------------|
| AI Pro (100 customers) | 100 | $34 | $3,400 |
| Voice AI (50 customers) | 50 | $15 | $750 |
| Integrated Chat (100) | 100 | $5 | $500 |
| **Monthly Total** | - | - | **$4,650** |
| **Annual** | - | - | **$55,800** |
| **Setup (one-time)** | - | - | **$800** |

#### ROI Projection (historical reference)
```
Current State:
- 100 customers
- 50 technicians (avg salary $65k/year = $31.25/hour)
- Current admin time: 40% dispatch + prep work
- Admin cost: 50 techs × $31.25/hr × 40% = 20 FTE

With Cerebro AI Pro:
- Admin overhead reduced to 10% (30% saved)
- 15 FTE freed up
- 15 × $31.25/hr × 2080 hours = $937,500 annual capacity

ROI:
- Cerebro cost: $55,800/year
- Capacity gain value: $937,500
- Net: $937,500 - $55,800 = $881,700 / year
- Payback period: 22 days (!!)
```

### Contract Flexibility (future hypothesis)
- **Month-to-month:** no lock-in
- **60-day money-back:** if ROI isn’t achieved within 60 days, full refund
- **Volume discounts:** 500+ customers: negotiate custom terms

### Go-to-Market (future, post internal validation)
- Initial target: MSP design partners (after internal validation at Refresh)
- Measure and publish ROI/case studies only after operational consistency
- Potential partnerships with PSA/RMM/documentation vendors in a later phase

### Pricing Strategy (future)
- Customer/tenant-based model (aligned with MSP billing)
- Simple tiers with clear add-ons
- Controlled trial once onboarding and support are standardized

---

## APPENDICES

### A. Glossary
- **PSA:** Professional Services Automation (ticketing system)
- **MSP:** Managed Service Provider (IT support company)
- **ITIL:** Information Technology Infrastructure Library (best practices)
- **SLA:** Service Level Agreement (response time commitment)
- **CSAT:** Customer Satisfaction Score
- **FTE:** Full-Time Equivalent (headcount)
- **RMM:** Remote Monitoring & Management (proactive IT monitoring)
- **LLM:** Large Language Model (AI)
- **STT:** Speech-to-Text
- **WebSocket:** Real-time bidirectional communication protocol

### B. References
- Thread Official: https://www.getthread.com
- Thread AI (Lemma): https://www.threadai.com
- Pricing: https://www.getthread.com/thread-pricing
- Voice AI: https://www.getthread.com/voice-ai
- Roadmap: https://www.getthread.com/roadmap

### C. Competitive Benchmark (Thread)
- Competitive benchmark used for critical-workflow functional parity
- References are concentrated in the appendices to keep the PRD body centered on Cerebro
- Document strategy: parity by critical workflow + differentiation in troubleshooting intelligence

#### Competitors & Positioning (reference)

| Competitor | Strengths | Weaknesses | Benchmark Advantage |
|-----------|-----------|------------|---------------------|
| **Tidio** | Chat builder | Limited PSA integration | Native PSA + Voice AI |
| **HubSpot Service Hub** | CRM integration | Expensive, over-featured | Lean, MSP-focused, ROI guarantee |
| **Zendesk** | Mature ecosystem | Complex, enterprise-heavy | Simple, fast implementation |
| **Freshdesk** | Good pricing | Limited AI | Deep AI + voice included |
| **Intercom** | Customer messaging | SaaS-focused, not MSP | MSP-specific, tech-focused |
| **In-house custom** | Total control | 6-12 months build, $500k+ | Time-to-market, ongoing maintenance |

#### Benchmark Incumbent Position (Thread)
- Strong perceived AI service desk focus for MSPs
- Strong native PSA integration narrative
- Omnichannel coverage (including voice) as a differentiator
- Strong commercial narrative of fast ROI
- Chat-first interface familiar to technicians

#### Cerebro Expansion Wedge (proposed)
- Preserve the service desk baseline by critical workflow
- Start with **Autotask + IT Glue + Ninja + SentinelOne + Check Point** (highest execution velocity)
- Differentiate with troubleshooting intelligence (context, hypothesis, handoff, less repetition)

---

**END OF PRD**

*Document Version: 1.0 | Last Updated: Feb 26, 2026 | Status: Production-Ready*
