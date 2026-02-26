# Product PRD (P0 Requirements)
## Cerebro: AI Service Delivery & Troubleshooting Platform for MSPs

**Date:** February 2026  
**Version:** 1.0  

This document defines product scope, user-facing requirements, and success measures.  
Implementation details live in the Execution Guide.

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
