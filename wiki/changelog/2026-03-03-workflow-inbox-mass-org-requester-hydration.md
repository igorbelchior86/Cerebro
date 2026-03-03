# Title
Workflow Inbox: hidratação em massa de Org/Requester sem cap legado de 25

# What changed
- Atualizado `hydrateMissingOrgRequester` em `apps/api/src/services/orchestration/ticket-workflow-core.ts` para substituir o cap fixo de 25 por lote configurável:
  - `P0_WORKFLOW_INBOX_HYDRATION_BATCH_SIZE` (default: `250`)
  - `P0_WORKFLOW_INBOX_HYDRATION_CONCURRENCY` (default: `5`, capped em `16`)
- Adicionada execução com concorrência limitada para evitar fanout irrestrito durante backfill de identidade.
- Antes de chamar `fetchTicketSnapshot`, o fluxo agora promove `company_name/requester_name` já existentes em `domain_snapshots` para `company/requester`.
- Adicionado teste de regressão em `apps/api/src/__tests__/services/ticket-workflow-core.test.ts` para validar hidratação de 30 tickets (acima do cap antigo).

# Why it changed
- O backlog real de tickets sem `org/requester` era muito maior que 25 itens por chamada, mantendo `Unknown org/requester` por longos períodos apesar da fonte canônica correta.
- Era necessário aumentar cobertura de hidratação retroativa mantendo controle de concorrência para não amplificar risco de rate limit no provider.

# Impact (UI / logic / data)
- UI: reduz significativamente incidência de `Unknown org/requester` na sidebar e no contexto do ticket após refresh/ciclo de inbox.
- Logic: o workflow inbox passa a executar backfill de identidade com capacidade proporcional ao backlog, sem fanout descontrolado.
- Data: sem migração; atualização incremental do estado runtime (`inbox` + `domain_snapshots`).

# Files touched
- `apps/api/src/services/orchestration/ticket-workflow-core.ts`
- `apps/api/src/__tests__/services/ticket-workflow-core.test.ts`
- `tasks/todo.md`
- `tasks/lessons.md`
- `wiki/changelog/2026-03-03-workflow-inbox-mass-org-requester-hydration.md`

# Date
2026-03-03
