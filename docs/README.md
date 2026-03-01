# Cerebro

> Chatbot operacional que gera playbooks de suporte automaticamente a partir de tickets Autotask, usando NinjaOne, IT Glue e LLM.

## Arquitetura

```
Input → PrepareContext (skill) → LLM Diagnose → ValidateAndPolicy (skill) → LLM PlaybookWriter → UI
```

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Node.js + TypeScript (Express) |
| Frontend | Next.js 14 |
| DB | PostgreSQL (pgvector) |
| Cache | Redis |
| LLM | Claude 3.5 Sonnet (Anthropic) |
| Deploy | Railway (API) + Vercel (UI) |

## Setup local

```bash
# 1. Instalar dependências
pnpm install

# 2. Copiar variáveis de ambiente
cp .env.example .env
# Editar .env com as tuas chaves

# 3. Subir Postgres + Redis
pnpm db:up

# 4. Aplicar schema
pnpm db:migrate

# 5. Iniciar dev
pnpm dev
```

## Fases de desenvolvimento

- [x] Fase 0: Setup, schema, tipos, CI/CD
- [ ] Fase 1: Conectores read-only (Autotask, Ninja, IT Glue)
- [ ] Fase 2: PrepareContext + Evidence Pack
- [ ] Fase 3: Diagnose + ValidateAndPolicy
- [ ] Fase 4: PlaybookWriter + UI
- [ ] Fase 5: Pilot e hardening

## Segurança

- Todos os tokens via variáveis de ambiente (nunca em código)
- Allowlist de endpoints — apenas leitura
- Auditoria completa em `audit_log`
- PII minimizada nos outputs LLM
