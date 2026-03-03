# Title
Workflow Inbox: hotfix de regressão de carregamento com fallback geral

# What changed
- Ajustado `hydrateMissingOrgRequester` em `apps/api/src/services/orchestration/ticket-workflow-core.ts` para reduzir custo síncrono no `listInbox`:
  - promoção local imediata de `company_name/requester_name` já presentes em `domain_snapshots`, sem chamada externa;
  - limitação explícita da hidratação remota por chamada (`P0_WORKFLOW_INBOX_HYDRATION_REMOTE_BATCH_SIZE`, default `25`);
  - timeout por ticket remoto (`P0_WORKFLOW_INBOX_HYDRATION_REMOTE_TIMEOUT_MS`, default `1500ms`).
- Mantido lote total configurável para candidatos (`P0_WORKFLOW_INBOX_HYDRATION_BATCH_SIZE`) com concorrência controlada.
- Atualizado teste em `apps/api/src/__tests__/services/ticket-workflow-core.test.ts` para configurar batch remoto no cenário de regressão.

# Why it changed
- A ampliação da hidratação em massa introduziu latência excessiva no caminho crítico de leitura (`listInbox`) sob backlog alto, causando queda para estado de fallback na UI.
- Era necessário preservar backfill de identidade sem bloquear a rota em round-trips externos extensos.

# Impact (UI / logic / data)
- UI: restaura carregamento da sidebar/contexto sem cair em fallback geral por timeout de hidratação remota.
- Logic: hidratação de identidade passa a priorizar dados locais persistidos e torna a parte remota bounded por batch+timeout.
- Data: sem migração; apenas atualização incremental do estado runtime do inbox/snapshots.

# Files touched
- `apps/api/src/services/orchestration/ticket-workflow-core.ts`
- `apps/api/src/__tests__/services/ticket-workflow-core.test.ts`
- `tasks/todo.md`
- `wiki/changelog/2026-03-03-workflow-inbox-hydration-regression-hotfix.md`

# Date
2026-03-03
