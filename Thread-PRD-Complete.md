# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## Thread: AI & Automation Engine for MSPs

**Data de Criação:** Fevereiro 2026  
**Versão:** 1.0  
**Escopo:** Análise Completa de Features & Arquitetura  
**Público-alvo:** Product Managers, Engenheiros, Tech Leads

---

## ÍNDICE

1. [Executive Summary](#executive-summary)
2. [Visão Geral do Produto](#visão-geral-do-produto)
3. [Proposta de Valor](#proposta-de-valor)
4. [Arquitetura Técnica](#arquitetura-técnica)
5. [Features Core](#features-core)
6. [Modelos de Pricing](#modelos-de-pricing)
7. [Integrações](#integrações)
8. [AI & Automações](#ai--automações)
9. [Roadmap & Futuro](#roadmap--futuro)
10. [Métricas de Sucesso](#métricas-de-sucesso)
11. [Requisitos de Implementação](#requisitos-de-implementação)

---

## EXECUTIVE SUMMARY

Thread é a primeira **AI Service Desk Engine** construída especificamente para **Managed Service Providers (MSPs)**. O produto combina chat moderno (Teams, Slack), automação inteligente via AI (triagem, roteamento, categorização), e integração nativa com **PSAs** (ConnectWise, Autotask, HaloPSA).

### Estatísticas-Chave
- **Eficiência de Technician:** +35% (redução de tempo administrativo)
- **Triage & Resolution Automáticos:** 10-25% de tickets resolvidos sem intervenção humana
- **Precisão de Automação:** 96% em categorização, prioridade, tipo de ticket
- **ROI:** Garantido em 24-60 horas após onboarding
- **Modelos de PSA Suportados:** ConnectWise Manage, Autotask, HaloPSA (com expansão)

### Diferenciais Competitivos
1. **Conversa + PSA Integrada:** Eliminação da duplicação de interfaces
2. **Voice AI + Chat:** Cobertura omnichannel (voz, chat, email, SMS)
3. **Sem Multi-Year Lock-in:** Contratos mês-a-mês
4. **60-Day Money-Back Guarantee:** ROI garantido ou reembolso total
5. **Maior Dataset Conversacional da Indústria:** Treinado em resolução real de tickets MSP

---

## VISÃO GERAL DO PRODUTO

### O que é Thread?

Thread é uma **plataforma de service delivery inteligente** que:

1. **Unifica Canais:** Chat (Teams, Slack, Web, Desktop) + Voz (Phone AI) + Email + SMS
2. **Automatiza Tickets:** IA faz triagem, categorização, roteamento, criação de time entries
3. **Integra com PSA:** Sincronização em tempo real (sem refresh manual)
4. **Potencializa Technicians:** Sugestões de resolução, contexto completo, histórico do cliente
5. **Mede ROI:** Calculadora integrada, métricas de economia, dashboard executivo

### Segmentação de Usuários

#### 1. **MSP Operators / Service Managers**
- Monitorar tickets em tempo real
- Visualizar AI em ação (triage automático)
- Acessar dashboard de ROI e capacity
- Configurar workflows personalizados

#### 2. **Technicians / Support Engineers**
- Responder em chat nativo (Teams/Slack)
- Ver contexto do cliente via AI
- Usar AI Chat (Magic) para redigir respostas
- Time entries automáticas
- Transferência de tickets com resumo

#### 3. **End-Users (Clientes do MSP)**
- Chat direto no Teams/Slack (sem mudar interface)
- Resolução mais rápida (10-25% sem tech envolvido)
- Atualizações em tempo real
- Experiência "VIP" com resposta instantânea

#### 4. **Executivos/C-Suite**
- ROI Calculator & Projections
- Capacity utilization metrics
- Savings forecast (FTE equivalente)
- Cost per ticket vs. manual dispatch

---

## PROPOSTA DE VALOR

### Para MSPs

#### Business Impact
| Métrica | Impacto | Fórmula |
|---------|--------|--------|
| **Tempo Administrativo** | -30% a -35% | ~2 horas/tech/semana reclamadas |
| **Tickets Auto-Resolvidos** | +10-25% | Sem dispatch necessário |
| **Accuracy (Categorização)** | 96% vs. ~70% manual | Melhor data quality → relatórios melhores |
| **Time to First Response** | -80% | Do email/phone para chat em segundos |
| **Customer Satisfaction** | +15-30% CSAT | Experiência moderna (Slack/Teams) |
| **Dispatch Overhead** | -100% | Tickets já pré-prepped pelo AI |
| **Revenue Reclamation** | +20-40% | ~2h/week/tech → 8-10 novos clientes/ano |

#### Operational Benefits
1. **Eliminação de Silos de Conhecimento:** Históricos e resoluções capturados automaticamente
2. **Modernização da Interface:** Familiar (Slack/Discord), não exige treinamento adicional
3. **Escalabilidade Sem Headcount:** +30% throughput com mesma equipe
4. **Implementação Rápida:** Go-live em 24-72 horas (vs. 3-6 meses com competitors)
5. **Compliance Automático:** ITIL + data accuracy checks integrados

### Para End-Customers

1. **Suporte 24/7 via Chat:** Onde trabalham (Teams/Slack)
2. **Resolução Instantânea:** 10-25% sem delay (não esperar tech)
3. **Contexto Completo:** Histórico imediato (não re-responder 3x mesma pergunta)
4. **Warm Handoff:** Se precisa tech, ticket já tem todas as infos

### Para Technicians

1. **Menos Paperwork:** Automação de títulos, categorias, time entries
2. **Melhor Colaboração:** Chat integrado + contexto + AI suggestions
3. **Focus no "Magic":** Menos admin, mais resolução criativa
4. **Mobile-Ready:** Responder tickets de qualquer lugar

---

## ARQUITETURA TÉCNICA

### Tech Stack (Referência)

```
┌─────────────────────────────────────────────────────────────┐
│                    Thread Platform                           │
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
│  │  │  Workflow    │ │  Sentiment   │ │  Contact    │ │   │
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
│  │  │   Ticket DB  │ │  Knowledge   │ │   Customer   │ │   │
│  │  │  (PostgreSQL)│ │   Articles   │ │   Context    │ │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ │   │
│  │                                                       │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │   │
│  │  │  Call/Chat   │ │  ML Models   │ │  Audit Log   │ │   │
│  │  │  Transcripts │ │  & Vectors   │ │  & Compliance│ │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. **Presentation Layer (Multi-Channel)**
- **Teams Integration:** Native chat connector, bot commands (/, /assign, /resolve)
- **Slack Integration:** Workspace app + channel threading
- **Web Portal:** Dashboard para managers + mobile app
- **Voice AI:** Phone system integration (asterisk-compatible)
- **Email Bridge:** Ingestion via API + outbound forwarding
- **Desktop App:** Electron-based (macOS/Windows) para standalone access

#### 2. **API Gateway & Message Queue**
- **WebSocket Server:** Real-time updates (tickets, assignments, responses)
- **REST API:** Standard CRUD + custom workflows
- **gRPC:** Performance-critical operations (transcoding, AI inference)
- **Event Streaming:** Kafka-like architecture para pipeline de eventos
- **Rate Limiting & Auth:** OAuth2 + API keys + tenant isolation

#### 3. **AI & Automation Engine**

##### 3a. **Triage AI**
- **LLM-Powered Classifier:** Analisa conteúdo do ticket
- **Outputs:** Title, Category, Priority, Type, Subtype, Recommended Resolution
- **Accuracy:** 96% vs. 70% manual
- **Training Data:** Largest conversational dataset em MSP
- **Fine-tuning:** ITIL + ticket history específico por MSP

**Workflow de Triagem:**
```
Customer Input (Chat/Email/Voice)
    ↓
Transcription (se voice) + Normalization
    ↓
LLM Analysis (Context: histórico cliente, KB articles)
    ↓
Confidence Scoring
    ↓
Classification (title, category, priority, type)
    ↓
Auto-Create Ticket no PSA
    ↓
10-25% Self-Resolved (sem dispatch)
    ↓
75-90% Routed + Assigned Automaticamente
```

##### 3b. **Magic AI (Technician Assistant)**
- **In-Thread Chat:** "Hey Magic, summarize this" / "Draft response for customer"
- **Capabilities:**
  - Redigir respostas ao cliente
  - Confirmar detalhes do ticket
  - Sugerir próximos passos
  - Gerar time entries
  - Resumir handoff para escalação
- **Context:** Acesso a histórico do customer, KB, ticket atual

##### 3c. **Voice AI**
- **Instant Answering:** Pickup automático (customizable hours)
- **Intelligent Routing:** Detecta urgência em tempo real (P1 flags)
- **Call Transcription:** Speech-to-text + gist automático
- **Warm Transfer:** Para technician disponível + contexto completo
- **Phone System Agnostic:** Asterisk, Cisco, Avaya, generic SIP
- **Features:**
  - Live call monitoring (manager can listen/jump in)
  - Automatic sentiment detection
  - Multi-language transcription (opcional)
  - Recording + archiving

##### 3d. **Contact Intelligence**
- **Caller Mapping:** Associa número → contato no CRM (fuzzy matching)
- **Historical Context:** Últimos 5 tickets + resolução
- **Customer Profile:** Nivel de serviço, SLA, histórico de issues
- **Risk Detection:** Angry customer? Escalate imediatamente

##### 3e. **Sentiment Analysis**
- **Real-time Monitoring:** Detecta frustração em chat/calls
- **Auto-Escalation:** Se sentiment = negativo, bump priority
- **Agent Coaching:** "Customer sounds upset, suggest resolution ASAP"

#### 4. **PSA Integration Layer**

##### Features
- **Native API Integration:**
  - ConnectWise Manage: Full REST API sync
  - Autotask: Webhooks + batch updates
  - HaloPSA: GraphQL + REST hybrid
- **Real-time Sync:** Sem refresh necessário
- **Field Mapping:** Customizável por MSP (drag-drop)
- **Action Buttons:** /assign, /close, /escalate dentro da chat

##### Fluxo de Sincronização
```
Thread AI Action (Auto-categorize, assign, etc)
    ↓
Generate PSA Command
    ↓
Queue via Message Bus (idempotency key)
    ↓
Call PSA API (OAuth2 token refresh automático)
    ↓
Retry Logic (exponential backoff)
    ↓
Webhook Confirmation
    ↓
Update Thread UI (real-time)
```

#### 5. **Data Layer & Knowledge Base**

##### Databases
- **Primary:** PostgreSQL (tickets, customers, interactions)
- **Vector DB:** Pinecone/Weaviate (embeddings para KB search)
- **Cache:** Redis (session, real-time counters)
- **Search:** Elasticsearch (full-text search on tickets + KB)
- **Time-series:** InfluxDB (metrics, call duration, resolution time)

##### Knowledge Management
- **KB Ingestion:** Upload articles, auto-extract từ resolved tickets
- **Semantic Search:** "How do I reset a password?" → matches relevant article
- **Auto-Linking:** AI suggests KB articles quando criando response
- **Version Control:** Track changes, rollback support

---

## FEATURES CORE

### 1. **Inbox & Ticket Management**

#### 1.1 Unified Inbox (Familiar Interface)
- **Single Pane of Glass:** Todos os tickets (Teams, Slack, Email, Voice, SMS)
- **Slash Commands:** /assign @tech, /close, /escalate, /snooze, /resolve
- **Priority View:** Flags visuais (P1 red, P2 yellow, etc)
- **Search & Filter:** "urgent AND customer=Acme AND category=Network"
- **Bulk Actions:** Select 10 tickets, bulk assign/close

#### 1.2 Ticket Auto-Population
- **Magic Fields:** Thread AI preenche automaticamente
  - Title (customer intent em 1 frase)
  - Category (network, printing, email, etc)
  - Priority (P1-P4 baseado em keywords + histórico)
  - Type & Subtype (Incident, Service Request, etc)
  - Resolution Summary (se 10-25% auto-resolvidos)

#### 1.3 Customer Context View
- **Side Panel:** Mostra perfil completo do customer
  - Name, company, SLA level
  - Last 5 tickets + resolutions
  - Contact info (email, phone)
  - Known issues + workarounds
  - Current status (on maintenance? migration?)

#### 1.4 Collaboration Features
- **@ Mentions:** @alice "Can you take this?" → ticket assigned
- **Internal Comments:** Notes não visíveis ao customer (v.s. public)
- **Thread Conversations:** Nested replies em chat (vs. flat)
- **Emoji Reactions:** Ack, thumbs up, etc
- **Pin Important Messages:** Keep reference links visible

### 2. **AI Automation Workflows**

#### 2.1 Pre-Built Workflows (Out-of-Box)
- **Triage & Route:** Auto-assign based on skills + availability
- **Priority Escalation:** P1 detected → Slack alert + auto-assign senior tech
- **Auto-Categorize:** Email subject "Printer not working" → category=Hardware
- **Quick Resolve:** FAQ-matched issues → auto-response + close
- **Satisfaction Survey:** Post-resolution survey → feedback loop

#### 2.2 Custom Workflow Builder
- **No-Code Interface:** Drag-drop conditions + actions
- **Trigger Types:**
  - Ticket created
  - Status changed
  - Customer sentiment negative
  - Time-based (SLA approaching)
  - Manual (button click)
  
- **Actions:**
  - Create ticket
  - Assign to specific tech / team
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

#### 2.3 Auto-Time Entry
- **Smart Capture:** Thread logs work sem input manual
- **Stopwatch Timer:** Start/stop integrado no chat
- **AI Estimation:** "This looks like a 30-min task"
- **Compliance:** Auto-populated per ITIL + billable/internal flags
- **Accuracy:** 90%+ matching com actual work done

### 3. **Voice AI**

#### 3.1 Instant Answering
- **Inbound:** Call comes in → AI picks up
- **Availability:** Customizable (9-5 Mon-Fri? 24/7?)
- **Greeting:** "Hi! You've reached [Company] support..."
- **IVR-like:** "Press 1 for billing, 2 for technical" (optional)

#### 3.2 Intelligent Call Routing
- **Detection:** "My invoice is wrong" → route to billing team
- **Availability Check:** "Tech team full? Queue customer."
- **Skills-Based:** "Password reset" → Junior tech available
- **Warm Transfer:** Never cold transfer
  - Brief senior tech: "Upset customer, billing issue, account #5432"
  - Customer stays on hold (music/info)
  - Warm intro: Senior picks up with context

#### 3.3 Automatic Transcription & Logging
- **Real-Time:** Call happens, Thread shows transcript live
- **Post-Call:** Full transcript in ticket (searchable)
- **Gist Creation:** "Customer complained about latency. Rebooted server. Resolved."
- **Summary:** Auto-creates or updates ticket with key details

#### 3.4 Integration with PSA
- **Ticket Creation:** Call → auto-ticket creation
- **Field Population:** Duration logged, priority set, category assigned
- **Call Recording:** Stored in ticket attachment (compliance)
- **Sentiment:** If negative, bump to P2

### 4. **Email & SMS Management**

#### 4.1 Email Integration
- **Inbound:** Emails parsed, auto-ticket creation
- **Threading:** Replies grouped with original ticket
- **Outbound:** Tech responds in Thread, auto-sends to customer email
- **Attachment Handling:** Screenshots, logs uploaded to ticket

#### 4.2 Two-Way SMS
- **Inbound:** Customer texts support number
- **Outbound:** Tech can respond via SMS (not just autoreply)
- **Real Conversations:** "Hi, we're investigating. ETA 30 mins" → Customer "Thanks!"
- **Cost Optimization:** AI suggests SMS for simple updates (cheaper than calls)

### 5. **Real-Time Synchronization**

#### 5.1 PSA Integration (Native)
- **Two-Way Sync:** No refresh needed ever
- **Conflict Resolution:** If tech updates in PSA, Thread reflects instantly
- **Field Mapping:** Customizable (drag-drop which fields sync)
- **Webhook Support:** PSA → Thread for status updates

**Sync Flow:**
```
Customer texts Thread
    ↓ (50ms)
AI processes, suggests category
    ↓ (200ms)
Create ticket call to PSA API
    ↓ (500ms-2s depending on PSA)
PSA webhook confirms → Thread shows ticket #
    ↓
Tech sees in Thread inbox + PSA
```

#### 5.2 Latency Guarantees
- **<100ms:** Local updates (UI, cache)
- **<2s:** PSA round-trip (including API)
- **Retry Logic:** Exponential backoff, max 5 retries

### 6. **Knowledge Management**

#### 6.1 Article Management
- **Import Sources:**
  - Markdown files uploaded
  - Confluence/SharePoint (auto-sync)
  - Jira knowledge base
  - PDF documents (OCR + parsing)
- **Tagging:** Auto-tagged by AI (category, keyword)
- **Search:** Full-text + semantic search

#### 6.2 Auto-Linking to Tickets
- **Smart Suggestion:** Ticket created "Printer issue" → suggests KB articles
- **One-Click Insert:** Tech clicks → response text populated
- **AI Refinement:** Customize before sending to customer

#### 6.3 Learning Loop
- **Resolved Tickets as KB:** "Reset password" ticket → auto-create KB article
- **Continuous Improvement:** New categories discovered → new articles suggested

### 7. **Analytics & Reporting**

#### 7.1 Dashboard Executive
- **ROI Calculator:** "You saved $X by preventing Y hours of admin"
- **Ticket Metrics:**
  - Total volume
  - Average resolution time
  - AI auto-resolved rate (%)
  - Customer satisfaction (CSAT)
- **Capacity Utilization:** Current tickets/tech, forecasted load
- **Cost per Ticket:** Manual vs. AI-assisted vs. auto-resolved

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
- **Data Residency:** Customizable (US, EU, etc)
- **GDPR Compliance:** Right to deletion, data export
- **HIPAA/FISMA:** Enterprise certifications available

#### 8.3 Call Recording Compliance
- **Automatic Disclosure:** "This call may be recorded" with customer consent
- **Secure Storage:** Encrypted, access-controlled
- **Retention:** Customizable policy (30 days, 1 year, etc)
- **Archival:** Migration to cold storage after X days

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
- **Multi-Tenant Architecture:** Multiple MSPs on same instance
- **Data Walls:** Strict isolation between orgs
- **Custom Branding:** Logo, colors per organization
- **White-Label:** Available at higher tier

---

## MODELOS DE PRICING

### Tiers de Serviço

#### Tier 1: AI Essentials
**$19 / managed customer / month**

**Ideal para:** MSPs com primeiros passos em AI, workflow simples

**Inclui:**
- Assistive Triage (suggestions, não automático)
- Inbox unificado (Teams + Slack)
- Workflows básicos (sem custom conditions)
- Unlimited AI usage
- Email integration
- PSA sync em tempo real
- 60-day money-back guarantee

**Limites:**
- Sem Voice AI
- Sem Contact Intelligence
- Sem Sentiment Analysis
- Sem AI Chat (Magic)

---

#### Tier 2: AI Pro ⭐ **Recomendado**
**$34 / managed customer / month + $800 (one-time setup)**

**Ideal para:** MSPs focados em ROI máximo, automação end-to-end

**Inclui TUDO de Essentials, PLUS:**
- **Triage & Reminder Agents** (automático, não sugestão)
- **Contact Intelligence** (caller mapping, customer profile)
- **AI Chat (Magic)** para technicians
- **Sentiment Analysis** em tempo real
- **Custom Workflows** (avançado)
- **Advanced Analytics** dashboard
- **Priority Support** (chat + email)
- **Dedicated Success Manager** (for 50+ seats)

**Add-ons (à la carte):**
- **Integrated Chat:** +$5/customer/month
  - Teams/Slack/Web/Desktop embeds
  - Pre-built templates
  
- **Voice AI:** +$15/customer/month
  - Instant answering
  - Warm transfers
  - Transcription + logging
  - Call recording
  - Real-time sentiment

- **AI Ticket Credits:** $0.50/credit
  - 1 credit = 1 ticket com AI triage
  - Para break-fix ou clientes pequenos

---

### Modelos de Volume

#### Pricing Example: MSP de 100 Clientes

| Componente | Quantidade | Unit Price | Total Mensal |
|-----------|-----------|-----------|-------------|
| AI Pro (100 customers) | 100 | $34 | $3,400 |
| Voice AI (50 customers) | 50 | $15 | $750 |
| Integrated Chat (100) | 100 | $5 | $500 |
| **Monthly Total** | - | - | **$4,650** |
| **Annual** | - | - | **$55,800** |
| **Setup (one-time)** | - | - | **$800** |

#### ROI Projection (Same MSP)
```
Current State:
- 100 customers
- 50 technicians (avg salary $65k/year = $31.25/hour)
- Current admin time: 40% dispatch + prep work
- Admin cost: 50 techs × $31.25/hr × 40% = 20 FTE

With Thread AI Pro:
- Admin overhead reduced to 10% (30% saved)
- 15 FTE freed up
- 15 × $31.25/hr × 2080 hours = $937,500 annual capacity

ROI:
- Thread cost: $55,800/year
- Capacity gain value: $937,500
- Net: $937,500 - $55,800 = $881,700 / year
- Payback period: 22 days (!!)
```

### Flexibilidade Contratual
- **Mês a Mês:** Sem lock-in
- **60-Day Money-Back:** Se não atingir ROI em 60 dias, reembolso total
- **Volume Discounts:** 500+ clientes = negocie custom terms

---

## INTEGRAÇÕES

### PSA (Primary)

#### ConnectWise Manage
- **API Type:** REST + OAuth2
- **Sync Scope:** Tickets, Companies, Contacts, Services, Time Entries
- **Real-time:** Webhooks para status updates
- **Authentication:** OAuth2 (automatic refresh)
- **Custom Fields:** Mapeáveis no UI (drag-drop)
- **Rate Limits:** Respeitadas (1000 req/min)

**Integrations Roadmap:**
```
Phase 1 (Live):
✅ ConnectWise Manage (full)
✅ Autotask (full)
✅ HaloPSA (full)

Phase 2 (Q2 2026):
🔄 Datto PSA (in progress)
🔄 ServiceTitan (planned)
🔄 Kaseya BMS (planned)

Phase 3 (Q3-Q4 2026):
📋 Jira Service Management
📋 FreshService / Freshdesk
📋 Zendesk
```

#### Autotask
- **API:** GraphQL + REST hybrid
- **Webhooks:** Real-time ticket status
- **Managed Services:** Full resource sync
- **Custom Objects:** Supported

#### HaloPSA
- **API:** REST + GraphQL
- **Strengths:** Strong UK/EU presence
- **Integrations:** Native Slack integration
- **Auth:** API token (no OAuth yet)

### Communication Platforms

#### Microsoft Teams
- **Bot:** Native Teams bot (slash commands)
- **Messaging:** Rich formatting, adaptive cards
- **Files:** Auto-attach tickets to Teams messages
- **Status:** Show agent status (available, in call, etc)
- **Deep Link:** Click notification → jumps to ticket

#### Slack
- **App:** Public marketplace app
- **Channels:** Thread channels (one per customer or category)
- **Workflows:** Native Slack workflow builder integration
- **Threads:** Nested replies for clean UI
- **Status:** 🟢 Available, 🔴 Busy, etc

#### Email
- **IMAP/POP3:** Email forwarding + ingestion
- **SMTP:** Outbound via Thread
- **Threading:** Replies grouped to original ticket
- **Attachment Handling:** Screenshots, logs, PDFs

#### Voice / Telephony
- **SIP:** Standard SIP integration (any provider)
- **PBX Systems:**
  - Asterisk (open source)
  - Cisco UCM
  - Avaya
  - Microsoft Teams Phone
  - Vonage Nexmo
- **Forwarding:** Redirect main number to Thread number
- **IVR Integration:** Optional button-press routing

### Third-Party Tools

#### RMM (Remote Monitoring & Management)
- **Connectwise Automate:** Agent events → tickets
- **Kaseya/VSA:** Automated remediation
- **N-Able N-Central:** Event triggers

#### Ticketing & Workflows
- **Zapier:** Inbound webhooks for custom integrations
- **Make (Integromat):** Workflow builder
- **Custom API:** REST endpoints for partners

#### Knowledge Management
- **Confluence:** Auto-sync KB articles
- **SharePoint:** Document ingestion
- **Jira:** Issue linking + wiki
- **Notion:** Manual upload of articles

#### CRM
- **HubSpot:** Contact sync
- **Salesforce:** Custom connector available

---

## AI & AUTOMAÇÕES

### AI Models & Training

#### 1. **Triage Engine**
- **Base Model:** Proprietary fine-tuned on 10M+ resolved MSP tickets
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
- **Accuracy:** 96% vs. 70% manual
- **Latency:** <500ms (P95)
- **Retraining:** Continuous (new resolved tickets feed the model)

#### 2. **Contact Intelligence**
- **Caller Mapping:** Phone number → contact record (fuzzy matching)
- **Historical Context:** Last 5 tickets + outcomes
- **Customer Risk Profile:** "Angry repeat caller" → escalate
- **Accuracy:** 94% match rate

#### 3. **Sentiment Analysis**
- **Real-time:** Analyzed during chat/call
- **Triggers:**
  - Negative → Bump priority, escalate
  - Angry profanity → Queue alert
  - Very happy → Offer upsell after resolution
- **Languages:** English, Spanish, French (extensible)

#### 4. **Speech Recognition (Voice AI)**
- **STT (Speech-to-Text):** ~95% accuracy
- **Supported Languages:** English (primary), Spanish, French (planned)
- **Speaker Identification:** Tech vs. Customer (diarization)
- **Real-time:** Live transcription (not post-call only)
- **Latency:** <2 seconds for sentence completion

#### 5. **Entity Extraction**
- **Detect:**
  - Customer names / Company names
  - IP addresses / Hostnames
  - URLs / File paths
  - Error codes / Stack traces
  - Phone numbers (for privacy redaction)
- **Confidence Scoring:** Only extract if high confidence

### Automation Workflows (Pre-Built)

#### Workflow: "Network Down - Auto-Escalate"
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

#### Workflow: "FAQ Match - Auto-Resolve"
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

#### Workflow: "New Customer Onboarding"
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

#### Pattern 1: "Suggest, Then Ask"
```
AI detects: "Ticket seems critical but low confidence on category"
Action: Show to manager + suggestion
Manager: Clicks 👍 or ⏳ "Wait for more info"
Outcome: Ticket routed per manager decision
```

#### Pattern 2: "Escalation Handoff"
```
Technician working on ticket
AI monitors: "This is getting complex, senior needed"
Action: AI suggests escalation to senior team
Tech: Clicks "Escalate" + AI drafts summary
Senior: Receives prepped ticket with full context
```

#### Pattern 3: "Quality Review"
```
AI auto-resolves 100 tickets
Sampling: QA team reviews random 5 for accuracy
If any fails: Feedback → model retraining
Continuous improvement loop
```

---

## ROADMAP & FUTURO

### Phase 1: Current (Live Now - Feb 2026)
✅ Unified Inbox (Teams, Slack, Web)  
✅ Triage AI + Auto-Categorization  
✅ Voice AI (instant answering)  
✅ PSA Integrations (CW, Autotask, Halo)  
✅ Workflows (pre-built + custom)  
✅ Email integration  
✅ Time entry automation  

### Phase 2: Near-Term (Q2-Q3 2026)
🔄 **SMS Two-Way** (in progress)  
🔄 **Sentiment Analysis** (rolling out)  
🔄 **Lemma AI Orchestration Platform** (composable workflows)  
🔄 **Service Now Integration** (enterprise PSA)  
🔄 **AI Agent Team** (create custom agents)  

### Phase 3: Medium-Term (Q4 2026 - Q1 2027)
📋 **RMM Deep Integration** (Kaseya, N-Able)  
📋 **Advanced Workflows** (state machines, branching logic)  
📋 **Predictive Analytics** (forecast ticket load 2 weeks out)  
📋 **Knowledge Graph** (auto-connect related tickets)  
📋 **Feedback Loop Optimization** (customer surveys post-resolution)  

### Phase 4: Long-Term Vision (2027+)
🎯 **Fully Agentic Team:**
- AI agents that act like human technicians
- Learn infrastructure specifics (DNS, DKIM, etc)
- Collaborate with other agents
- Escalate only when necessary

🎯 **Mission-Critical AI Orchestration** (Lemma Platform):
- Compose workflows across 100+ systems
- Native security & governance
- Enterprise-grade reliability (99.99% uptime SLAs)

🎯 **Predictive Maintenance:**
- "Your VPN cert expires in 7 days" → auto-renew ticket
- "Server CPU trending up" → suggest upgrade

---

## MÉTRICAS DE SUCESSO

### Para MSPs

| Métrica | Baseline | Target (6 mo) | Measurement |
|---------|----------|--------------|-------------|
| **Ticket Resolution Time** | 4 hours | 2 hours | Avg close time |
| **Technician Admin Time** | 40% | 10% | Time tracking logs |
| **AI Auto-Resolution Rate** | 0% | 15-20% | No dispatch tickets |
| **CSAT Score** | 75 | 88+ | Post-ticket survey |
| **Dispatch Overhead** | 100% | 0% | Manual routing needed |
| **Capacity Utilization** | 70% | 95% | Tickets/tech/day |
| **Cost per Ticket** | $45 | $12 | Admin cost amortized |

### Para End-Customers

| Métrica | Impacto |
|---------|--------|
| **First Response Time** | -80% (email 4 hrs → chat 5 min) |
| **Resolution Time** | -50% (avg 2 days → 1 day) |
| **24/7 Availability** | ✅ Voice AI handles after-hours |
| **Self-Service Rate** | +25% (AI suggests KB articles) |

### Para Thread Business

| Métrica | Foco |
|---------|------|
| **NPS Score** | >60 (benchmark for SaaS: 50) |
| **Customer Retention** | >95% (sticky due to ROI guarantee) |
| **ARR Growth** | 150%+ YoY |
| **Time-to-Value** | <24 hours (go-live to first ticket) |

---

## REQUISITOS DE IMPLEMENTAÇÃO

### Para Construir Produto Similar

#### Tech Stack Recomendado

```
Frontend:
- React 18+ / Next.js (web UI)
- React Native ou Flutter (mobile)
- Electron (desktop app)
- WebSocket client (real-time updates)

Backend:
- Node.js/Express OU Python/FastAPI (API server)
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

### Core Development Phases

#### Phase 0: MVP (2-3 months)
**Goal:** Validate PMF, launch first integrations

1. **Unified Inbox** (Teams + basic chat)
2. **Ticket CRUD + PSA sync** (ConnectWise only)
3. **Simple Triage AI** (using OpenAI GPT-4)
4. **Basic workflows** (pre-built only)
5. **Email ingestion**

**Team:** 6-8 engineers (backend, frontend, ML)

#### Phase 1: Core Features (3-4 months)
1. **Voice AI** (phone integration)
2. **Slack integration**
3. **Autotask/Halo support**
4. **Custom workflows builder** (no-code)
5. **Analytics dashboard**
6. **Time entry automation**

**Team:** +4 engineers (total 10-12)

#### Phase 2: Advanced AI (3-4 months)
1. **Contact Intelligence**
2. **Sentiment Analysis**
3. **Advanced workflows** (state machines)
4. **Knowledge management system**
5. **Predictive analytics**
6. **SMS integration**

**Team:** +3 ML engineers (total 13-15)

#### Phase 3: Scaling (ongoing)
1. **More PSA integrations** (ServiceTitan, etc)
2. **RMM integrations**
3. **Lemma orchestration layer** (if ambitious)
4. **Enterprise features** (SSO, audit logs, etc)
5. **International expansion**

### Estimate: 12-18 months to feature parity

---

## COMPETITIVE LANDSCAPE

### Competitors & Positioning

| Competitor | Strengths | Weaknesses | Thread Advantage |
|-----------|-----------|-----------|------------------|
| **Tidio** | Chat builder | Limited PSA integration | Native PSA + Voice AI |
| **HubSpot Service Hub** | CRM integration | Expensive, over-featured | Lean, MSP-focused, ROI guarantee |
| **Zendesk** | Mature ecosystem | Complex, enterprise-heavy | Simple, fast implementation |
| **Freshdesk** | Good pricing | Limited AI | Deep AI + voice included |
| **Intercom** | Customer messaging | SaaS-focused, not MSP | MSP-specific, tech-focused |
| **In-house custom** | Total control | 6-12 mo build, $500k+ | Time-to-market, ongoing maintenance |

**Thread's Unique Position:**
- Only true **AI Service Desk for MSPs**
- Native **PSA integration** (ConnectWise native)
- **Voice AI included** (not add-on)
- **ROI guarantee** (60-day money-back)
- **Familiar interface** (Slack/Teams, not new tool)

---

## SUMMARY & NEXT STEPS

### Rekomendasi para construir produto similar:

1. **Start com MVP:** Inbox + 1 PSA integration + basic AI triage
   - Validate PMF with 3-5 beta MSP customers
   - Measure: Can they achieve ROI in 60 days?

2. **Assemble Team:**
   - 2-3 senior backend engineers
   - 1-2 frontend engineers
   - 1 ML engineer (or use API-first approach com OpenAI)
   - 1 DevOps / infrastructure
   - 1 product manager
   - 1 support specialist

3. **Technology Priorities:**
   - Real-time sync (WebSocket + event streaming essential)
   - API-first (to support multiple PSAs)
   - Multi-tenancy (key for SaaS economics)
   - Security from day 1 (encryption, auth, audit logs)

4. **Go-to-Market:**
   - Target 50-100 beta MSPs (direct sales)
   - Provide 60-day money-back guarantee (critical for trust)
   - Measure & publicize ROI (case studies)
   - Partner with PSA vendors (co-sell)

5. **Pricing Strategy:**
   - Freemium or 14-day trial (low friction)
   - Per-customer model (aligns with MSP billing)
   - Volume discounts at 500+ customers
   - Simple tiers (not too many SKUs)

### Expected Timeline:
- MVP → Market: **4-6 months**
- Break-even: **12-18 months** (depending on sales velocity)
- Market leadership: **3-5 years** (if execution strong + funding adequate)

---

## APÊNDICES

### A. Glossário
- **PSA:** Professional Services Automation (ticketing system)
- **MSP:** Managed Service Provider (IT support company)
- **ITIL:** Information Technology Infrastructure Library (best practices)
- **SLA:** Service Level Agreement (response time commitment)
- **CSAT:** Customer Satisfaction Score
- **FTE:** Full-Time Equivalent (headcount)
- **RMM:** Remote Monitoring & Management (proactive IT monitoring)
- **LLM:** Large Language Model (AI)
- **STT:** Speech-To-Text
- **WebSocket:** Real-time bidirectional communication protocol

### B. Referências
- Thread Official: https://www.getthread.com
- Thread AI (Lemma): https://www.threadai.com
- Pricing: https://www.getthread.com/thread-pricing
- Voice AI: https://www.getthread.com/voice-ai
- Roadmap: https://www.getthread.com/roadmap

---

**END OF PRD**

*Document Version: 1.0 | Last Updated: Feb 26, 2026 | Status: Production-Ready*