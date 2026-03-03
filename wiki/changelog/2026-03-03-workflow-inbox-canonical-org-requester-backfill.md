# Title
Workflow Inbox: backfill canônico de Org/Requester para tickets ativos

# What changed
- Gateway de snapshot Autotask passou a enriquecer `company_name` via `companyID` (best-effort), além de `contact_name`.
- `listInbox` agora hidrata tickets ativos sem `company/requester` consultando snapshot canônico do Autotask (limitado a 25 itens por chamada) e persiste o resultado no inbox.
- Dedupe de aliases no `listInbox` passou a preservar `company` e `requester` durante merge.
- Poller de sync passou a enviar também `contact_name`, `company_id` e `contact_id` no payload de evento.
- Normalização de snapshots de evento agora também registra `company_id/contact_id`.

# Why it changed
- Tickets ativos já existentes continuavam sem organização/solicitante, mesmo após correções de propagação futura.
- Era necessário corrigir retroativamente o backlog ativo com base na fonte canônica do AT.

# Impact (UI / logic / data)
- UI: cards na sidebar (Personal/Global) passam a exibir Org/Requester reais para tickets ativos já existentes, após refresh.
- Logic: fluxo de inbox ganha hidratação canônica controlada para campos ausentes.
- Data: sem migration; atualização incremental de estado runtime (`inbox` + `domain_snapshots`) apenas para campos de identidade ausentes.

# Files touched
- `apps/api/src/services/orchestration/autotask-ticket-workflow-gateway.ts`
- `apps/api/src/services/orchestration/ticket-workflow-core.ts`
- `apps/api/src/services/adapters/autotask-polling.ts`

# Date
2026-03-03
