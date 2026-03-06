# Title
Bug Hunt: fechamento explícito de servidor de teste e hardening do pool Postgres em teste

# What changed
- Corrigido `apps/api/src/__tests__/routes/integrations.credentials.test.ts` para abrir e fechar explicitamente o servidor HTTP temporário usado no teste de rota.
- Ajustados `apps/api/src/db/index.ts` e `apps/api/src/db/pool.ts` para usar `allowExitOnIdle` somente quando `NODE_ENV === 'test'`.

# Why it changed
- A rodada de bug hunt reproduziu um problema de teardown: a suíte da API terminava com sucesso, mas o Jest acusava que ainda havia operação assíncrona viva no fim da execução.
- A instrumentação de diagnóstico identificou um `Server` temporário no teste de credenciais, o que justificou o fechamento explícito desse recurso.
- O hardening do pool Postgres reduz a chance de conexões ociosas de teste manterem o processo aberto quando não há mais trabalho real em andamento.

# Impact (UI / logic / data)
- UI: nenhum impacto.
- Logic: nenhum fluxo de produção alterado; mudanças limitadas ao ambiente de teste e ao pool em `NODE_ENV === 'test'`.
- Data: nenhum impacto em banco, contratos públicos ou integrações.

# Files touched
- `apps/api/src/__tests__/routes/integrations.credentials.test.ts`
- `apps/api/src/db/index.ts`
- `apps/api/src/db/pool.ts`
- `tasks/todo.md`

# Date
2026-03-05
