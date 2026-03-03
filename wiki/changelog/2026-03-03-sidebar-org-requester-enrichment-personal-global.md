# Title
Sidebar Personal/Global: preenchimento real de Org e Requester

# What changed
- Removido hardcode de `Unknown org/requester` no adapter da sidebar Personal.
- Fluxo de ingestão Autotask -> workflow inbox passou a propagar `company_name` e `requester`.
- Estado do workflow inbox passou a carregar `company` e manter snapshots de `company_name/requester_name`.
- Endpoint Global `/autotask/sidebar-tickets` agora resolve fallback de `companyID/contactID` quando nomes não vêm no row principal.

# Why it changed
- Os cards estavam exibindo `Unknown org` e `Unknown requester` mesmo com dados disponíveis no Autotask ou em snapshots do workflow.
- Era necessário restaurar paridade visual e semântica com os dados reais dos tickets ativos.

# Impact (UI / logic / data)
- UI: cards da sidebar Personal e Global passam a mostrar organização e solicitante reais quando disponíveis.
- Logic: enriquecimento determinístico com fallback por IDs no handler Global.
- Data: sem migração; apenas ampliação de campos já existentes no fluxo de evento/snapshot.

# Files touched
- `apps/api/src/services/adapters/autotask-polling.ts`
- `apps/api/src/services/application/route-handlers/autotask-route-handlers.ts`
- `apps/api/src/services/orchestration/ticket-workflow-core.ts`
- `apps/web/src/lib/p0-ui-client.ts`
- `apps/web/src/lib/workflow-sidebar-adapter.ts`

# Date
2026-03-03
