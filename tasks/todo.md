# Task: Executar passos 1 e 2 (Global direto por queue + backfill de ingestão)

**Status**: completed
**Started**: 2026-02-25

## Plan
- [x] Step 1: Adicionar endpoint backend para `Global` buscar tickets diretamente do Autotask por queue (shape compatível com sidebar)
- [x] Step 2: Integrar `ChatSidebar` para usar fonte direta do Autotask no modo `Global` por queue selecionada
- [x] Step 3: Adicionar endpoint de backfill/reconciliação de tickets Autotask recentes para aumentar cobertura do pipeline/sidebar
- [x] Step 4: Executar verificação (typecheck + smoke tests/curl) e atualizar wiki

## Open Questions
- Endpoint de backfill implementado com opção `runPipeline`; smoke test/execução foram feitos em modo seguro (`runPipeline=false`) para ampliar cobertura da sidebar sem custo de LLM.

## Progress Notes
- Pedido atual: executar os próximos passos 1 e 2 sugeridos anteriormente (fonte Global direta do Autotask + backfill/reconciliação de ingestão).
- Contexto confirmado: ainda existem tickets do Autotask (inclusive de hoje) fora do pipeline/sidebar (`tickets_processed`/`triage_sessions`/`ticket_ssot`).
- Passo 1 (backend): adicionado `GET /autotask/sidebar-tickets` (auth-required) com shape compatível da sidebar, filtro por `queueId`, lookup de labels de queue e janela de recência padrão (30 dias) para evitar páginas históricas do Autotask.
- Passo 1 (frontend): `ChatSidebar` usa a fonte direta do Autotask no modo `Global` quando uma queue específica (`queue:<id>`) está selecionada; `All queues` continua usando a lista atual do pipeline.
- Passo 2 (backend): adicionado `POST /autotask/backfill-recent` (auth-required) para reconciliar tickets Autotask recentes com cobertura do Cerebro (`tickets_processed`/`triage_sessions`/`ticket_ssot`), com opções `dryRun` e `runPipeline`.
- Smoke test autenticado do passo 1: `GET /autotask/sidebar-tickets?queueId=29682833&limit=10` retornou payload normalizado com `ticket_id` em formato `T...`, `queue_name`, `created_at` e `source=autotask_direct`.
- Importante: o primeiro smoke test do endpoint direto mostrou tickets antigos (2014) devido à ordenação/paginação do Autotask; correção aplicada adicionando `lookbackHours` padrão (720h / 30 dias).
- Execução real do backfill (via script interno com a mesma lógica, por causa de auth no curl local): `autotaskRecent=32`, `missingCoverageRecent=21`, `seeded=21`.
- Verificação após backfill: `/email-ingestion/list` passou de `count=175`/`todayCount=27` para `count=196`/`todayCount=48`; `todayStillMissingAfterSeed=0`.
- Smoke test autenticado do passo 2 (`POST /autotask/backfill-recent` dryRun): `missingCoverage=0` após o seed.

## Review
- What worked: separar os passos em endpoint direto (Global) e reconciliação/backfill resolveu o problema de produto sem acoplar mais a UI ao payload cru do Autotask.
- What was tricky: a paginação/ordem do Autotask por queue retornou histórico antigo na primeira página; foi necessário impor janela de recência padrão para a UX do sidebar.
- Time taken:
