# Title
Paridade AT/Cerebro: identidade canônica, dedupe e purge de tickets removidos

# What changed
- Workflow core agora resolve identidade canônica de ticket em sync usando `external_id` + `ticket_number`.
- Workflow core agora remove aliases duplicados do mesmo ticket durante ingestão de sync.
- Workflow core agora preenche `ticket_number` no estado de inbox durante sync.
- `listInbox` agora aplica dedupe de legado persistido por chave canônica e limpa duplicatas antigas.
- Poller Autotask ganhou purge tenant-scoped para remover tickets do inbox local quando não existem mais no AT.
- Adapter web da sidebar passou a exibir `ticket_number` real quando disponível.

# Why it changed
- Havia duplicidade no Cerebro para o mesmo chamado do AT com IDs distintos (`numeric` vs `T...`).
- Havia divergência de realtime e contagem de queue por falta de canonicidade no read-model.
- Tickets deletados no AT continuavam no Cerebro por ausência de reconciliação de exclusão.

# Impact (UI / logic / data)
- UI: cards de ticket exibem o número correto (`T...`) quando presente, reduzindo ambiguidade visual.
- Logic: sincronização realtime passa a convergir em uma entrada única por ticket do AT.
- Data: inbox runtime pode ser auto-limpo de duplicatas e de tickets inexistentes no provider.

# Files touched
- `apps/api/src/services/orchestration/ticket-workflow-core.ts`
- `apps/api/src/services/adapters/autotask-polling.ts`
- `apps/web/src/lib/p0-ui-client.ts`
- `apps/web/src/lib/workflow-sidebar-adapter.ts`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
2026-03-03
