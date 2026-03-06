# Task: API lint warning reduction round 4
**Status**: completed
**Started**: 2026-03-06T17:20:00-05:00

## Plan
- [x] Step 1: Medir os maiores arquivos de teste com warnings.
- [x] Step 2: Limpar dois lotes grandes de warnings mecânicos em testes antigos.
- [x] Step 3: Revalidar lint/typecheck/testes focados e registrar a nova baseline na wiki.

## Progress Notes
- Skills usados conforme contrato:
  - `workflow-orchestrator`
  - Sequential Thinking MCP
  - Context7 MCP (TypeScript `unknown`, type guards e `satisfies`)
- Baseline reaberta desta rodada:
  - `apps/api` iniciou com `654` warnings
  - o foco foi só em testes antigos, para alto retorno e baixo risco de runtime
- Lote 1:
  - `apps/api/src/__tests__/services/prepare-context-device-resolution.test.ts`
  - `apps/api/src/__tests__/services/autotask-ticket-workflow-gateway.test.ts`
  - `apps/api/src/__tests__/services/triage-orchestrator-tenant.test.ts`
  - substituição de `as any` por interfaces internas pequenas, casts via `unknown`, fábricas de gateway e mocks tipados
  - impacto: `34` warnings removidos
- Lote 2:
  - `apps/api/src/__tests__/services/validate-policy-gates.test.ts`
  - `apps/api/src/__tests__/services/background-service-unref.test.ts`
  - `apps/api/src/__tests__/services/read-model-fetchers-credentials.test.ts`
  - troca de mutações `as any` por tipos auxiliares, `satisfies`, helpers genéricos e spies tipados
  - impacto: `22` warnings removidos
- Medição final:
  - `apps/api` caiu de `654` para `598` warnings
  - redução líquida desta rodada: `56` warnings
  - fila de testes ficou mais concentrada em:
    - `7` `src/__tests__/services/ticket-workflow-core.test.ts`
    - `5` `src/__tests__/services/workflow-realtime.test.ts`
    - `5` `src/__tests__/services/context-persistence.test.ts`
    - `5` `src/__tests__/clients/autotask.test.ts`

## Review
- Verification:
- `pnpm exec eslint 'src/__tests__/services/prepare-context-device-resolution.test.ts' 'src/__tests__/services/autotask-ticket-workflow-gateway.test.ts' 'src/__tests__/services/triage-orchestrator-tenant.test.ts' -f unix` ✅
- `pnpm --filter @cerebro/api test -- src/__tests__/services/prepare-context-device-resolution.test.ts src/__tests__/services/autotask-ticket-workflow-gateway.test.ts src/__tests__/services/triage-orchestrator-tenant.test.ts` ✅
- `pnpm exec eslint 'src/__tests__/services/validate-policy-gates.test.ts' 'src/__tests__/services/background-service-unref.test.ts' 'src/__tests__/services/read-model-fetchers-credentials.test.ts' -f unix` ✅
- `pnpm --filter @cerebro/api test -- src/__tests__/services/validate-policy-gates.test.ts src/__tests__/services/background-service-unref.test.ts src/__tests__/services/read-model-fetchers-credentials.test.ts` ✅
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/api lint` ✅ (`0` errors / `598` warnings)
- Documentation:
- `wiki/changelog/2026-03-06-lint-warning-reduction-round-4-test-hotspots.md`

---

# Task: API lint warning reduction round 3
**Status**: completed
**Started**: 2026-03-06T16:35:00-05:00

## Plan
- [x] Step 1: Reconfirmar a baseline atual e escolher o próximo lote pesado de baixo risco.
- [x] Step 2: Limpar hotspots grandes na camada de contexto e nos serviços P0 read-only.
- [x] Step 3: Revalidar lint/typecheck/testes focados e registrar a nova baseline.

## Progress Notes
- Skills usados conforme contrato:
  - `workflow-orchestrator`
  - Sequential Thinking MCP
  - Context7 MCP (TypeScript narrowing com `unknown`/type guards)
- Baseline reaberta desta rodada:
  - `apps/api` iniciou em `808` warnings
  - hotspots escolhidos por baixo risco funcional e alto retorno:
    - `src/services/orchestration/fusion-engine.ts`
    - `src/services/context/prepare-context-helpers.ts`
    - `src/services/p0-readonly-enrichment.ts`
    - `src/services/context/history-resolver.ts`
- Fix 1:
  - `apps/api/src/services/orchestration/fusion-engine.ts`
  - troca de `any` por `JsonRecord`, payloads tipados, inputs explícitos e narrowing em resolução de conflitos/adjudicação
  - resultado: arquivo ficou sem warnings
- Fix 2:
  - `apps/api/src/services/context/prepare-context-helpers.ts`
  - criação de tipos locais para registros IT Glue/Ninja, engine de enriquecimento e acesso seguro por path
  - resultado: arquivo caiu de `42` warnings para `0`
- Fix 3:
  - `apps/api/src/services/p0-readonly-enrichment.ts`
  - troca de leituras `as any` por `JsonRecord`, normalização segura de payloads e alinhamento do store para o caminho `domain/*`
  - `apps/api/src/services/ai/p0-readonly-enrichment.ts` virou re-export fino para eliminar duplicação de implementação
  - resultado: os dois arquivos ficaram sem warnings
- Fix 4:
  - `apps/api/src/services/context/history-resolver.ts`
  - remoção de `any` em `fusionAudit`, refinamento final e calibração histórica; adição de helpers seguros para arrays/objetos JSON
  - resultado: arquivo ficou sem warnings
- Medição final:
  - `apps/api` caiu de `808` para `654` warnings
  - redução líquida desta rodada: `154` warnings

## Review
- Verification:
- `pnpm exec eslint 'src/services/orchestration/fusion-engine.ts' -f unix` ✅
- `pnpm exec eslint 'src/services/context/prepare-context-helpers.ts' -f unix` ✅
- `pnpm exec eslint 'src/services/p0-readonly-enrichment.ts' 'src/services/ai/p0-readonly-enrichment.ts' -f unix` ✅
- `pnpm exec eslint 'src/services/context/history-resolver.ts' -f unix` ✅
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/api test -- src/__tests__/services/prepare-context.test.ts src/__tests__/services/prepare-context-device-resolution.test.ts src/__tests__/services/p0-readonly-enrichment.test.ts` ✅
- `pnpm --filter @cerebro/api lint` ✅ (`0` errors / `654` warnings)
- Documentation:
- `wiki/changelog/2026-03-06-lint-warning-reduction-round-3-context-and-p0-cleanup.md`

---

# Task: API lint warning reduction round 2
**Status**: completed
**Started**: 2026-03-06T15:05:00-05:00

## Plan
- [x] Step 1: Validar as limpezas pesadas já aplicadas em `enrichment-cache.ts` e `prepare-context.ts`.
- [x] Step 2: Atacar os maiores hotspots restantes de baixo risco em `ticket-workflow-core.ts`, `autotask-polling.ts` e `autotask-polling.test.ts`.
- [x] Step 3: Revalidar lint/typecheck/testes focados e registrar a nova baseline na wiki.

## Progress Notes
- Skills usados conforme contrato:
  - `workflow-orchestrator`
  - Sequential Thinking MCP
  - Context7 MCP (TypeScript `unknown`/narrowing para substituir `any`)
- Baseline reaberta desta rodada:
  - `apps/api` tinha `1251` warnings no início da limpeza pesada
  - `prepare-context.ts` já havia sido derrubado parcialmente para `101` warnings antes do fechamento desta rodada
- Validação/fix 1:
  - `apps/api/src/services/context/enrichment-cache.ts`
  - limpeza pesada de parsing JSON com `JsonRecord` + `asJsonRecord()` + `asJsonRecordArray()`
  - resultado: arquivo ficou sem warnings
- Fix 2:
  - `apps/api/src/services/orchestration/ticket-workflow-core.ts`
  - substituição dos acessos `as any` por snapshots/records tipados, remoção de código morto e consolidação de leitura de payload/snapshot
  - resultado: arquivo caiu de `124` warnings para `0`
- Fix 3:
  - `apps/api/src/services/adapters/autotask-polling.ts`
  - aplicação do mesmo padrão de `JsonRecord`/helpers, tipagem explícita para cliente opcional do Autotask e remoção de `any` no payload de sync/picklists
  - resultado: arquivo caiu de `94` warnings para `0`
- Fix 4:
  - `apps/api/src/__tests__/services/autotask-polling.test.ts`
  - remoção de `any` em spies, mocks de cliente e arrays de inbox com helpers de teste (`asAutotaskClient`, `asPollingInternals`)
  - resultado: arquivo caiu de `47` warnings para `0`
- Medição final:
  - `apps/api` caiu para `808` warnings
  - top hotspots restantes:
    - `101` `src/services/context/prepare-context.ts`
    - `77` `src/services/application/route-handlers/playbook-route-handlers.ts`
    - `63` `src/services/application/route-handlers/autotask-route-handlers.ts`
    - `42` `src/services/context/prepare-context-helpers.ts`

## Review
- Verification:
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/api test -- src/__tests__/services/ticket-workflow-core.test.ts` ✅
- `pnpm --filter @cerebro/api test -- src/__tests__/services/autotask-polling.test.ts` ✅
- `pnpm --filter @cerebro/api lint` ✅ (`0` errors / `808` warnings)
- File-level lint:
- `apps/api/src/services/context/enrichment-cache.ts` ✅ (`0` warnings)
- `apps/api/src/services/orchestration/ticket-workflow-core.ts` ✅ (`0` warnings)
- `apps/api/src/services/adapters/autotask-polling.ts` ✅ (`0` warnings)
- `apps/api/src/__tests__/services/autotask-polling.test.ts` ✅ (`0` warnings)
- Documentation:
- `wiki/changelog/2026-03-06-lint-warning-reduction-round-2-heavy-api-hotspots.md`

---

# Task: Recursive concurrency hunt round 2
**Status**: completed
**Started**: 2026-03-06T14:20:00-05:00

## Plan
- [x] Step 1: Continuar a caça recursiva a partir do próximo hotspot de concorrência reproduzível.
- [x] Step 2: Corrigir o isolamento tenant-scoped do full-flow de playbook.
- [x] Step 3: Corrigir fronteiras falsas de transação em rotas de identidade e platform-admin.
- [x] Step 4: Corrigir corridas de identidade global por e-mail e de alocação de slug de tenant.
- [x] Step 5: Corrigir lost update no merge do `ticket_ssot` vindo do Autotask.
- [x] Step 6: Revalidar a API inteira e documentar tudo na wiki.

## Progress Notes
- Skills usados conforme contrato:
  - `bug-hunter`
  - Sequential Thinking MCP
  - Context7 MCP (PostgreSQL advisory locks / JSONB merge e node-postgres transactions)
- Ciclo 1:
  - `apps/api/src/services/application/route-handlers/playbook-route-handlers.ts`
  - `resolveOrCreateFullFlowSession()` ignorava `tenantId` ao procurar sessão existente e no lock advisory
  - correção aplicada com lock composto `tenantId:ticketId` + lookup tenant-scoped
  - regressão adicionada em `apps/api/src/__tests__/routes/playbook.full-flow-stale-ticket.test.ts`
- Ciclo 2:
  - `apps/api/src/services/application/route-handlers/auth-route-handlers.ts`
  - `apps/api/src/services/application/route-handlers/platform-admin-route-handlers.ts`
  - `apps/api/src/db/seed-admin.ts`
  - vários fluxos faziam `query('BEGIN') -> query(...) -> query('COMMIT')`, o que no `pg Pool` não garante a mesma conexão
  - correção aplicada convertendo os blocos para `transaction(async (client) => ...)`
  - regressão adicionada em `apps/api/src/__tests__/routes/identity-transaction-boundaries.test.ts`
- Ciclo 3:
  - `apps/api/src/services/identity/email-lock.ts`
  - `auth-route-handlers.ts`, `platform-admin-route-handlers.ts`, `seed-admin.ts`
  - criação/ativação de identidade dependia de `SELECT email -> INSERT`, sem trava global
  - duas requisições simultâneas podiam criar o mesmo e-mail em tenants diferentes
  - correção aplicada com `pg_advisory_xact_lock` por e-mail normalizado + checagem de disponibilidade dentro da transação
  - regressão adicionada no mesmo `identity-transaction-boundaries.test.ts`
- Ciclo 4:
  - `apps/api/src/services/identity/tenant-slug.ts`
  - `auth-route-handlers.ts`, `platform-admin-route-handlers.ts`, `seed-admin.ts`
  - criação de tenant ainda fazia `SELECT slug disponível -> INSERT`, permitindo colisão concorrente em `tenants.slug`
  - correção aplicada com retry automático do slug após `unique_violation`
  - regressão adicionada no mesmo `identity-transaction-boundaries.test.ts`
- Ciclo 5:
  - `apps/api/src/services/application/route-handlers/autotask-route-handlers.ts`
  - atualização de contexto do Autotask lia o `ticket_ssot` antigo, mesclava em memória e sobrescrevia o JSON inteiro
  - duas atualizações simultâneas podiam apagar campos uma da outra
  - correção aplicada com merge atômico em SQL (`jsonb`) para payload geral + `autotask_authoritative`
  - regressão adicionada em `apps/api/src/__tests__/routes/autotask.ticket-ssot-merge.test.ts`
- Varredura pós-correção:
  - `query('BEGIN')` residual nas rotas críticas da API voltou a zero
  - o próximo scan não revelou outro caso baixo-risco reproduzível tão claro quanto os cinco acima

## Review
- Verification:
- `pnpm --filter @cerebro/api test -- src/__tests__/routes/playbook.full-flow-stale-ticket.test.ts` ✅
- `pnpm --filter @cerebro/api exec jest --detectOpenHandles --silent src/__tests__/routes/playbook.full-flow-stale-ticket.test.ts` ✅
- `pnpm --filter @cerebro/api test -- src/__tests__/routes/identity-transaction-boundaries.test.ts src/__tests__/routes/auth.workspace-settings.test.ts src/__tests__/routes/playbook.full-flow-stale-ticket.test.ts` ✅
- `pnpm --filter @cerebro/api exec jest --detectOpenHandles --silent src/__tests__/routes/identity-transaction-boundaries.test.ts src/__tests__/routes/auth.workspace-settings.test.ts src/__tests__/routes/playbook.full-flow-stale-ticket.test.ts` ✅
- `pnpm --filter @cerebro/api test -- src/__tests__/routes/autotask.ticket-ssot-merge.test.ts src/__tests__/routes/identity-transaction-boundaries.test.ts src/__tests__/routes/auth.workspace-settings.test.ts src/__tests__/routes/playbook.full-flow-stale-ticket.test.ts` ✅
- `pnpm --filter @cerebro/api exec jest --detectOpenHandles --silent src/__tests__/routes/autotask.ticket-ssot-merge.test.ts src/__tests__/routes/identity-transaction-boundaries.test.ts src/__tests__/routes/auth.workspace-settings.test.ts src/__tests__/routes/playbook.full-flow-stale-ticket.test.ts` ✅
- `pnpm --filter @cerebro/api test -- --runInBand` ✅ (`45` suítes / `216` testes)
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/api lint` ✅ (`0` errors; warnings antigos continuam)
- `pnpm -r typecheck` ✅
- `pnpm -r lint` ✅ (`0` errors; warnings antigos continuam em `apps/web` e `apps/api`)
- Documentation:
- `wiki/changelog/2026-03-06-recursive-concurrency-hunt-identity-locks-and-ssot-merge.md`

---

# Task: Recursive concurrency hunt round 1
**Status**: completed
**Started**: 2026-03-06T12:05:00-05:00

## Plan
- [x] Step 1: Reabrir a caça com foco explícito em concorrência, timers e races de persistência.
- [x] Step 2: Reproduzir um problema de concorrência por vez, corrigir e validar antes de seguir.
- [x] Step 3: Repetir o ciclo em hotspots adicionais até a próxima varredura ampla não revelar novo caso baixo-risco reproduzível.
- [x] Step 4: Atualizar `tasks/todo.md`, `tasks/lessons.md` e wiki com a trilha desta rodada.

## Progress Notes
- Skills usados conforme contrato:
  - `bug-hunter`
  - `cerebro-concurrency-race-auditor`
  - Sequential Thinking MCP
  - Context7 MCP (consulta do Jest para timers/fake timers)
- Ciclo 1:
  - `apps/api/src/services/application/route-handlers/integrations-route-handlers.ts`
  - `withTimeout()` deixava o timer “perdedor” vivo quando a checagem terminava rápido
  - correção aplicada com `clearTimeout()` em `finally`
  - regressão adicionada em `apps/api/src/__tests__/routes/integrations.credentials.test.ts`
- Ciclo 2:
  - `apps/api/src/services/context/persistence.ts`
  - `persistEvidencePack()` fazia `SELECT -> INSERT/UPDATE` sem serialização por `sessionId`
  - duas gravações simultâneas podiam inserir duplicado
  - correção aplicada com `pg_advisory_xact_lock` + `transaction`
  - regressão adicionada em `apps/api/src/__tests__/services/context-persistence.test.ts`
- Ciclo 3:
  - `apps/api/src/services/context/persistence.ts`
  - SSOT/text artifact/context appendix faziam `guard -> write`, permitindo que sessão antiga sobrescrevesse artefato novo do mesmo ticket
  - correção aplicada com upsert atômico condicionado à sessão mais recente
  - regressão adicionada no mesmo `context-persistence.test.ts`
- Ciclo 4:
  - `apps/api/src/services/prepare-context.ts`
  - caminho legado ainda exportava implementações antigas de persistência, então parte do runtime podia escapar da correção nova
  - correção aplicada delegando o caminho legado para `services/context/persistence.ts`
  - regressão adicionada em `apps/api/src/__tests__/services/prepare-context-persistence-bridge.test.ts`
- Ciclo 5:
  - `apps/api/src/services/orchestration/triage-orchestrator.ts`
  - `apps/api/src/services/adapters/autotask-polling.ts`
  - intervalos de background eram criados sem `unref`, prendendo o processo mesmo após o trabalho útil terminar
  - correção aplicada com `intervalId.unref?.()` / `retryIntervalId.unref?.()`
  - regressões adicionadas em `apps/api/src/__tests__/services/triage-orchestrator-tenant.test.ts` e `apps/api/src/__tests__/services/autotask-polling.test.ts`
- Varredura pós-correção:
  - `pnpm --filter @cerebro/api test -- --runInBand` passou com `41` suítes / `208` testes
  - `pnpm -r typecheck` passou
  - `pnpm -r lint` passou sem erros (`warnings` preexistentes continuam)
  - hotspot scan final ainda marca riscos em `auth-route-handlers.ts`, mas o caso restante é de classe alta (`read-modify-write` em rota de auth/settings) e cai na zona de autorização explícita do contrato

## Review
- Verification:
- `pnpm --filter @cerebro/api test -- src/__tests__/routes/integrations.credentials.test.ts` ✅
- `pnpm --filter @cerebro/api exec jest --detectOpenHandles --silent src/__tests__/routes/integrations.credentials.test.ts` ✅
- `pnpm --filter @cerebro/api test -- src/__tests__/services/context-persistence.test.ts` ✅
- `pnpm --filter @cerebro/api exec jest --detectOpenHandles --silent src/__tests__/services/context-persistence.test.ts` ✅
- `pnpm --filter @cerebro/api test -- src/__tests__/services/prepare-context-persistence-bridge.test.ts` ✅
- `pnpm --filter @cerebro/api exec jest --detectOpenHandles --silent src/__tests__/services/prepare-context-persistence-bridge.test.ts` ✅
- `pnpm --filter @cerebro/api test -- src/__tests__/services/autotask-polling.test.ts src/__tests__/services/triage-orchestrator-tenant.test.ts` ✅
- `pnpm --filter @cerebro/api exec jest --detectOpenHandles --silent src/__tests__/services/autotask-polling.test.ts src/__tests__/services/triage-orchestrator-tenant.test.ts` ✅
- `pnpm --filter @cerebro/api test -- --runInBand` ✅ (`41` suítes / `208` testes)
- `pnpm -r typecheck` ✅
- `pnpm -r lint` ✅ (`0` errors; warnings preexistentes)
- Documentation:
- `wiki/changelog/2026-03-06-recursive-concurrency-hunt-persistence-guards-and-poller-unref.md`

---

# Task: Bug hunt full-repo round 2
**Status**: completed
**Started**: 2026-03-05T21:00:47-05:00

## Plan
- [x] Step 1: Reabrir a caça a bugs com baseline completo de `lint`, `typecheck`, `test` e sinais de concorrência.
- [x] Step 2: Priorizar o próximo lote de bugs reproduzíveis no repositório inteiro.
- [x] Step 3: Corrigir, testar e repetir o ciclo até estabilizar.
- [x] Step 4: Atualizar `tasks/todo.md` e wiki com os resultados desta rodada.

## Progress Notes
- Rodada iniciada. A rodada anterior já limpou os erros de `lint` do `apps/web` e estabilizou o teste do poller.
- Baseline desta rodada:
  - `pnpm --filter @cerebro/api test -- --runInBand` reproduziu o warning: "Jest did not exit one second after the test run has completed"
  - `pnpm --filter @cerebro/api test -- --detectOpenHandles` passou sem handle explícito
- Investigação executada com `bug-hunter` + Sequential Thinking + Context7:
  - leitura dirigida dos timers/singletons/pools da API
  - consulta da documentação do Jest (`--detectOpenHandles`, teardown) e do `node-postgres` (`allowExitOnIdle`)
  - instrumentação temporária para medir handles ativos ao final da suíte
- Bug corrigido nesta rodada:
  - `apps/api/src/__tests__/routes/integrations.credentials.test.ts` deixava um `Server` HTTP temporário sob responsabilidade implícita do `supertest`; o teste agora abre e fecha o servidor explicitamente em `finally`
- Hardening aplicado:
  - `apps/api/src/db/index.ts` e `apps/api/src/db/pool.ts` agora usam `allowExitOnIdle` somente em `NODE_ENV === 'test'`
- Repetição pós-correção:
  - teste de rota passou isolado
  - `--detectOpenHandles` na suíte da API continuou limpo
  - `lint` e `typecheck` da API passaram
- Observação residual:
  - o warning final do `--runInBand` continuou mesmo com `globalTeardown` temporário reportando `handles=[]` e `requests=[]`; não houve evidência suficiente para alterar código de runtime além do que foi corrigido/hardened

## Review
- Verification:
- `pnpm --filter @cerebro/api test -- src/__tests__/routes/integrations.credentials.test.ts` ✅
- `pnpm --filter @cerebro/api test -- --detectOpenHandles` ✅ (`199` testes passando; sem handle reportado)
- `pnpm --filter @cerebro/api lint` ✅ (`0` errors; warnings preexistentes)
- `pnpm --filter @cerebro/api typecheck` ✅
- Documentation:
- `wiki/changelog/2026-03-05-bug-hunt-route-test-server-teardown-and-pg-test-exit-hardening.md`

---

# Task: Bug hunt no repositório Cerebro
**Status**: completed
**Started**: 2026-03-05T20:48:51-05:00

## Plan
- [x] Step 1: Inspecionar a stack do repositório, o skill `bug-hunter` e o contrato operacional do projeto.
- [x] Step 2: Executar baseline de testes, lint e typecheck para montar a lista de bugs reproduzíveis.
- [x] Step 3: Corrigir os bugs priorizados com mudanças mínimas e adicionar regressões quando necessário.
- [x] Step 4: Reexecutar validações, revisar impacto e atualizar a wiki obrigatória.

## Progress Notes
- Baseline executado:
  - `pnpm -r typecheck` passou
  - `pnpm -r lint` falhou no `apps/web` com 12 erros objetivos de código morto/imports não usados
  - `pnpm -r test` passou, mas o `autotask-polling.test.ts` deixava erro oculto de `tenant-1` inválido no catch-up e o Jest emitia aviso de worker aberto
- Lista priorizada de bugs reproduzíveis:
  - `apps/web`: código morto/imports/props não usados quebrando o gate de `lint`
  - `apps/api/src/__tests__/services/autotask-polling.test.ts`: estado global de catch-up de backlog habilitado por padrão contaminando testes e causando flutuação de tempo
- Correções aplicadas:
  - remoção mínima de variáveis/imports/props mortos no `apps/web`
  - isolamento explícito do env `AUTOTASK_POLLER_BACKLOG_IDENTITY_CATCHUP_ENABLED` no arquivo de teste do poller, com reativação só no teste que valida o catch-up
- Resultado:
  - `lint` do web voltou a zero erros
  - teste sensível a latência do poller estabilizado (`435ms -> 206ms` no run validado)
  - `--detectOpenHandles` no `autotask-polling.test.ts` ficou limpo

## Review
- Verification:
- `pnpm --filter @cerebro/web lint` ✅ (`0` errors, `4` warnings preexistentes)
- `pnpm --filter @cerebro/api test -- autotask-polling.test.ts` ✅
- `pnpm --filter @cerebro/api test -- --detectOpenHandles autotask-polling.test.ts` ✅
- `pnpm -r typecheck` ✅
- `pnpm -r lint` ✅ (`0` errors; warnings preexistentes no monorepo)
- `pnpm -r test` ✅ (`199` testes passando em `apps/api`)
- `pnpm --filter @cerebro/api test -- --detectOpenHandles` ✅ (`199` testes passando; sem handle pendente reportado)
- Documentation:
- `wiki/changelog/2026-03-05-bug-hunt-lint-recovery-and-poller-test-isolation.md`

---

# Task: Catch-up agressivo para backlog antigo sem Org/Requester
**Status**: completed
**Started**: 2026-03-05T16:55:00-05:00

## Plan
- [x] Step 1: Normalizar o pedido do usuário e confirmar o caminho técnico para catch-up explícito read-only.
- [x] Step 2: Expor um sweep background-safe no workflow core para hidratar unresolved antigos sem depender de `GET /workflow/inbox`.
- [x] Step 3: Acionar esse sweep pelo poller Autotask com prioridade `oldest-first` e batch agressivo tenant-scoped.
- [x] Step 4: Adicionar regressões para o workflow core e para o dispatch do poller.
- [x] Step 5: Validar em testes direcionados, validação monorepo e runtime real; documentar na wiki.

## Progress Notes
- O `workflowService.listInbox()` já tinha código de hidratação bounded, mas ele não era executado pelo poller e o estágio local promovia `created_at` sozinho como “resolvido”, bloqueando o fetch remoto do ticket.
- O pedido “zerar isso mais agressivamente” foi implementado sem writes no PSA: somente leituras tenant-scoped em `fetchTicketSnapshot()` + atualização do read model interno.
- Fix aplicado:
  - `TicketWorkflowCoreService.runInboxHydrationSweep()` criado para fazer catch-up explícito em background
  - sweep usa `oldest-first`, `batchSize=100`, `remoteBatchSize=50` por padrão
  - `hydrateMissingOrgRequester()` só bloqueia o fetch remoto quando o ticket realmente sai de `needsInboxHydration`
  - `AutotaskPollingService.runOnce()` agora dispara o sweep após o dispatch de triage recente
  - log operacional novo: `workflow.inbox.hydration_sweep_applied`
- Evidência live no tenant `9439a8d1-6858-4a9d-a132-a1569b9da5f7`:
  - antes do catch-up agressivo: `olderMissing=61`
  - após restart + primeiro ciclo: `olderMissing=44`
  - após segundo ciclo: `olderMissing=34`
  - composição restante após segundo ciclo:
    - `withCompanyId=25`
    - `withContactId=7`
    - `withBothIds=6`
    - `withNoIds=8`

## Review
- Verification:
- `pnpm --filter @cerebro/api test -- autotask-polling.test.ts ticket-workflow-core.test.ts` ✅
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm -r lint` ✅ (warnings preexistentes; zero errors)
- `pnpm -r typecheck` ✅
- `pnpm -r test` ✅ (`192` testes passando em `apps/api`)
- `./scripts/stack.sh restart` ✅
- Runtime/API evidence after restart:
  - `GET /workflow/inbox` autenticado: `count=124`
  - backlog antigo sem `Org/Requester`: `61 -> 44 -> 34`
  - requester agora preenchido em tickets antes travados, por exemplo `T20260218.0021 -> Fabio Nogueira`
- Documentation:
- `wiki/changelog/2026-03-05-autotask-aggressive-backlog-identity-catchup.md`

---

# Task: Destravar hidratação de backlog antigo no queue snapshot Autotask
**Status**: completed
**Started**: 2026-03-05T15:55:00-05:00

## Plan
- [x] Step 1: Validar o estado real do `/workflow/inbox` do tenant do usuário e medir o backlog sem `Org/Requester`.
- [x] Step 2: Corrigir o reconcile de queue snapshot para aplicar lookup canônico nos tickets antigos ainda não hidratados.
- [x] Step 3: Corrigir a idempotência do sync para permitir replay quando o payload canônico mudar.
- [x] Step 4: Tirar o queue snapshot da frente do batch pesado de triage e reduzir custo upstream do query por fila.
- [x] Step 5: Executar testes/typecheck, reiniciar a stack e confirmar evidência no runtime e no endpoint autenticado.

## Progress Notes
- O runtime do tenant `9439a8d1-6858-4a9d-a132-a1569b9da5f7` já tinha mais backlog do que a UI sugeria: `97` tickets no `workflow inbox`, com `71` tickets anteriores a `2026-03-04T19:18:00.000Z` sem `company/requester`.
- O caminho de `runQueueParitySnapshot()` estava ingerindo tickets antigos via `autotask_reconcile`, mas sem `resolveCanonicalIdentityBatch()`, então `Org/Requester/Contact` ficavam `null` para esse lote.
- Mesmo após adicionar lookup, os tickets antigos já materializados continuavam congelados porque o `event_id` do sync era só `source + ticket + occurredAt`; quando o payload ganhou identidade depois, o core tratava como duplicado e descartava o replay.
- O queue snapshot também estava atrás do batch de triage recente no `runOnce()`, o que atrasava a convergência do inbox, e ainda fazia `backlogSearch` com `queueID` puro. Depois da paginação completa no client, isso virou scan caro demais por fila.
- Persistia mais um defeito de fairness: `resolveCanonicalIdentityBatch()` priorizava tickets mais novos por `createDate`. Com cap de `10` empresas/contatos por rodada, backlog antigo podia ficar eternamente atrás dos tickets recentes.
- Fix aplicado:
  - `runQueueParitySnapshot()` agora carrega o inbox atual, filtra `identityCandidates` que ainda não têm identidade canônica e passa `identityLookup` no `autotask_reconcile`
  - `event_id` do poller/reconcile agora inclui fingerprint estável do payload canônico, permitindo replay idempotente quando `company/requester/contact_email` mudarem
  - `queue snapshot` roda antes do dispatch de triage
  - queries do queue snapshot agora excluem status terminais no próprio `Tickets/query` com `status noteq ...`
  - hidratação de identidade do `queue snapshot` agora prioriza os tickets antigos primeiro (`oldest-first`) para evitar starvation do backlog histórico
  - log operacional novo: `adapters.autotask_polling.parity_queue_snapshot_applied`
- Evidência live após restart:
  - log do API: `parity_queue_snapshot_applied` com `queue_count=26`, `ticket_count=103`, `identity_candidates=102`
  - `GET /workflow/inbox` autenticado para `igor@refreshtech.com` passou a retornar `124` tickets
  - tickets antigos antes quebrados agora hidratados no inbox:
    - `T20260304.0011` -> `BRK Global Marketing` / `John Drenkhahn`
    - `T20260303.0015` -> `Ferguson Supply & Box Company` / `Jasen Nolff`
    - `T20260304.0008` -> `InStore Group` / `Tom Palombo`
  - após a correção de fairness e novo restart, o backlog antigo sem identidade caiu de `85` para `71` já no primeiro ciclo do poller
  - tickets antigos de 2025/início de 2026 passaram a convergir, incluindo `T20260302.0017` (`Weaver Bennett & Bland` / `Eran Weaver`) e `T20251216.0014` (`Stintino Management`)

## Review
- Verification:
- `pnpm --filter @cerebro/api test -- autotask-polling.test.ts autotask.test.ts triage-orchestrator-tenant.test.ts` ✅
- `pnpm --filter @cerebro/api typecheck` ✅
- `./scripts/stack.sh restart` ✅
- Runtime/API evidence after restart:
  - `workflow inbox` autenticado: `count=124`
  - runtime tenant-scoped antes do fix de fairness: `count=124`, `olderCount=98`, `olderMissing=85`
  - inbox autenticado após o fix de fairness: `count=124`, `olderCount=98`, `olderMissing=71`
  - redução observável do lote antigo sem identidade e aumento do backlog ativo materializado, sem starvation dos tickets mais velhos
- Documentation:
- `wiki/changelog/2026-03-05-autotask-queue-backlog-hydration-and-active-snapshot-fix.md`
- `wiki/changelog/2026-03-05-autotask-backlog-fairness-oldest-first-hydration.md`

---

# Task: Corrigir ingestão parcial do PSA e claim cross-tenant na triage Autotask
**Status**: completed
**Started**: 2026-03-05T15:10:00-05:00

## Plan
- [x] Step 1: Validar se a fila estava truncando tickets no conector do PSA ou no poller.
- [x] Step 2: Corrigir a paginação do `/tickets/query` para seguir `nextPageUrl` até exaustão.
- [x] Step 3: Corrigir o dispatch `poller -> triage orchestrator` para preservar `tenant_id` e não cair no tenant default.
- [x] Step 4: Adicionar regressões para paginação completa e tenant-scoped session claim.
- [x] Step 5: Reiniciar a stack, validar no Postgres/runtime e documentar na wiki.

## Progress Notes
- O client `packages/integrations/src/autotask/client.ts` retornava apenas a primeira página de `/tickets/query`; o restante do backlog nunca chegava ao Cerebro.
- A doc interna `apps/APIAT.md` já exigia seguir `pageDetails.nextPageUrl`, mas o conector ignorava isso.
- Mesmo após corrigir a cobertura do poller, os tickets novos ainda morriam na triage porque `TriageOrchestrator.claimOrCreateSession()` criava sessão no primeiro tenant do banco (`SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1`) quando o poller chamava `runPipeline()` sem `tenant_id`.
- Evidência de runtime antes do fix:
  - `workflow.realtime.publish` no tenant `9439...`
  - `triage_sessions` novos em `5b5f...`
  - `prepare_context` falhando com `401 Unauthorized`/cooldown por credencial do tenant errado
- Fix aplicado:
  - paginação completa via `nextPageUrl` no `AutotaskClient.searchTickets()`
  - `AutotaskPollingService` agora passa `tenant_id` para o dispatch de triage
  - `TriageOrchestrator` agora faz claim/create tenant-scoped quando `tenant_id` é fornecido
  - retry sweep também passou a carregar e propagar `tenant_id`
- Evidência após o fix:
  - novo `triage_session` para ticket `132938` criado em `9439a8d1-6858-4a9d-a132-a1569b9da5f7`
  - `ticket_ssot` persistido para `132938`
  - payload canônico persistido com `company = BRK Global Marketing`, `requester_name = Colleen Newlin`, `requester_email = colleen.newlin@brkmarketing.com`

## Review
- Verification:
- `pnpm --filter @cerebro/api test -- autotask.test.ts autotask-polling.test.ts triage-orchestrator-tenant.test.ts` ✅
- `pnpm --filter @cerebro/api typecheck` ✅
- `./scripts/stack.sh restart` ✅
- Verificação Postgres/runtime após restart:
  - `triage_sessions` por tenant: `9439...` subiu de `2` para `4`
  - `132938` passou a existir no tenant correto `9439...` e a cópia antiga errada ficou congelada em `5b5f...`
  - `ticket_ssot_count` subiu de `2` para `3`
- Documentation:
- `wiki/changelog/2026-03-05-autotask-poller-pagination-and-tenant-claim-fix.md`

---

# Task: Corrigir lookup canônico de Org/Requester no poller Autotask
**Status**: completed
**Started**: 2026-03-05T14:10:00-05:00

## Plan
- [x] Step 1: Inspecionar dados reais do poller e confirmar se o problema está no backend canônico ou na UI.
- [x] Step 2: Ajustar lookup de identidade do poller para latência real do Autotask sem perder bound operacional.
- [x] Step 3: Adicionar regressão para propagação de `company/requester/contact_email`.
- [x] Step 4: Validar com testes alvo, reiniciar stack e confirmar repovoamento.
- [x] Step 5: Atualizar wiki/changelog obrigatório.

## Progress Notes
- Logs do runtime mostram `adapters.autotask_polling.identity_lookup_degraded` com `company_resolved=0` e `contact_resolved=0`.
- Medição manual com as credenciais do tenant confirmou latência real do Autotask acima do budget atual:
  - `searchTickets ≈ 2241ms`
  - `getCompany ≈ 1089ms`
  - `getContact ≈ 598ms`
- O código estava limitando cada lookup a `450ms` com budget total de `1200ms`, então o poller nunca resolvia nomes de org/requester para o workflow inbox.
- A correção final exigiu três ajustes no poller:
  - timeout por `getCompany/getContact` elevado para `2500ms`,
  - budget de lookup elevado para `8000ms`,
  - priorização de lookup alinhada à ordem de `createDate` (mesma cronologia que a sidebar usa), não `lastActivityDate`.
- A cobertura por run ficou em `10 companies / 10 contacts`, o que foi suficiente para preencher os cards recentes visíveis no tenant real sem estourar o budget.
- Runtime limpo e repovoado após restart confirmou preenchimento canônico em tickets antes quebrados: `T20260305.0022`, `T20260305.0021`, `T20260305.0014`, `T20260305.0010`, `T20260305.0003`, `T20260304.0022`.

## Review
- Verification:
- `pnpm --filter @cerebro/api test -- autotask-polling.test.ts` ✅
- `pnpm --filter @cerebro/api typecheck` ✅
- `./scripts/stack.sh restart` ✅
- Runtime verificado em `apps/api/.run/p0-workflow-runtime.json` após reset:
  - `company_capped=10`, `company_truncated=0`, `company_resolved=10`
  - `contact_capped=10`, `contact_truncated=2`, `contact_resolved=10`
  - top tickets recentes agora com identidade canônica preenchida
- Documentation:
- `wiki/changelog/2026-03-05-autotask-poller-identity-priority-coverage-fix.md`

---

# Task: Corrigir precedência canônica de Org/Requester/Contact na triage UI
**Status**: completed
**Started**: 2026-03-05T13:41:08-05:00

## Plan
- [x] Step 1: Reproduzir o split-brain entre `/workflow/inbox` e `/playbook/full-flow` para `org/requester/contact`.
- [x] Step 2: Corrigir a precedência na UI para preservar o workflow canônico como source of truth.
- [x] Step 3: Validar com lint/typecheck do web e registrar evidências.
- [x] Step 4: Atualizar wiki/changelog obrigatório.

## Progress Notes
- Investigação identificou que `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx` regrava `sidebarTickets` após `GET /playbook/full-flow`, priorizando `ssot/backendTicket` antes do row canônico vindo de `/workflow/inbox`.
- Isso permite que um payload stale/parcial do full-flow degrade `Org`/`Contact` no card da esquerda e no contexto da direita, apesar do read model do workflow já conter valores melhores.
- A precedência foi invertida para `workflow inbox row -> sidebar row atual -> full-flow`, mantendo `full-flow` apenas como fallback para identidade canônica.

## Review
- Verification:
- `pnpm --filter @cerebro/web typecheck` ✅
- `pnpm --filter @cerebro/web lint` ✅ (0 errors, 4 warnings preexistentes em `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`)
- Documentation:
- `wiki/changelog/2026-03-05-triage-canonical-identity-precedence-fix.md`

---

# Task: Canonical flow audit cleanup (remove legacy sidebar dead path)
**Status**: completed
**Started**: 2026-03-05T12:43:00-05:00

## Plan
- [x] Step 1: Confirmar escopo e mapear referências do legado `sidebar-tickets` em API/tests.
- [x] Step 2: Remover código morto em `autotask-route-handlers.ts`, preservando o stub 410 e helpers usados por `backfill-recent`.
- [x] Step 3: Excluir os 3 testes obsoletos do endpoint legado.
- [x] Step 4: Atualizar wiki de arquitetura com evidência do fluxo canônico único.
- [x] Step 5: Executar validação (`jest` + grep `sidebar-tickets`) e registrar evidências.

## Progress Notes
- Limpeza do bloco legado de sidebar aplicada em `autotask-route-handlers.ts`; `sortTicketsByCreateDateDesc` e `buildAutotaskTicketSearch` foram mantidos para `backfill-recent`.
- Testes obsoletos do endpoint legado foram removidos.
- Documento de arquitetura criado em `wiki/architecture/canonical-flow-audit.md` com diagrama Mermaid válido.

## Review
- Verification:
- `cd apps/api && npx jest --passWithNoTests` ✅ (`36 passed, 36 total`; `178 passed, 178 total`)
- `rg -n "sidebar-tickets" apps/api/src` ✅ (apenas rota deprecada 410 em `autotask-route-handlers.ts`)
- `rg -n "fetchSidebarTicketsPayload|withTryAdvisoryLock|SidebarTicketRow|classifySidebarTicketsDegradedReason|loadSidebarTicketsWithCoordination" apps/api/src/services/application/route-handlers/autotask-route-handlers.ts` ✅ (sem ocorrências)
- Documentation:
- `wiki/architecture/canonical-flow-audit.md`

---

# Task: Stopwatch PSA-confirmed (time entry primário + timer UI no ChatInput)
**Status**: completed
**Started**: 2026-03-04T19:26:42-05:00

## Plan
- [x] Step 1: Implementar fluxo primário `time_entry` no canal externo com confirmação PSA.
- [x] Step 2: Projetar metadados confirmados de time entry no workflow (mirror path).
- [x] Step 3: Adicionar timer UI no canto direito abaixo da chat box (oposto à toolbar), com start/pause/reset.
- [x] Step 4: Integrar feedback do comando no timer (synced/pending/error) e manter fallback de nota pública.
- [x] Step 5: Validar com testes/lint/typecheck e documentar wiki/changelog.

## Progress Notes
- `ChatInput` recebeu slot de footer à direita para renderizar stopwatch sem acoplar lógica de domínio no componente de input.
- Fluxo externo (`external_psa_user`) agora envia `time_entry` como primário e inicia listener de status para espelhar tempo confirmado pelo PSA.
- `AutotaskTicketWorkflowGateway` passou a retornar metadados confirmados de time entry e `TicketWorkflowCoreService` projeta `last_time_entry_*` em `domain_snapshots`.
- Timer persiste por ticket em `localStorage`, oferece start/pause/reset e reinicia automaticamente após `time_entry` confirmado.

## Review
- Verification:
- `pnpm --filter @cerebro/api test -- autotask-ticket-workflow-gateway.test.ts ticket-workflow-core.test.ts` ✅
- `pnpm -r lint` ✅ (0 errors; warnings preexistentes)
- `pnpm -r typecheck` ✅
- `pnpm -r test` ✅
- Documentation:
- `wiki/changelog/2026-03-04-stopwatch-time-entry-listener-mirror.md`

---

# Task: Stopwatch visível em qualquer superfície de ticket (home + existing)
**Status**: completed
**Started**: 2026-03-04T20:02:00-05:00

## Plan
- [x] Step 1: Corrigir ausência do timer em `triage/home` (ticket novo).
- [x] Step 2: Garantir chave de persistência canônica por `ticket_id` em `triage/[id]`.
- [x] Step 3: Revalidar render/estado do timer no slot `footerRightContent`.
- [x] Step 4: Executar validações web (`typecheck`/`lint`).
- [x] Step 5: Documentar na wiki/changelog.

## Progress Notes
- `triage/home` agora renderiza stopwatch no mesmo espaço do `ChatInput` (rodapé direito, oposto à toolbar), com controles `Start/Pause/Reset`.
- A tela `triage/[id]` passou a resolver chave de persistência com `data.session.ticket_id` quando disponível, evitando dependência de identificador transitório da rota.
- Com isso, o timer fica disponível quando o ticket é aberto como novo ou existente, em qualquer superfície de triagem.

## Review
- Verification:
- `pnpm --filter @cerebro/web typecheck` ✅
- `pnpm --filter @cerebro/web lint` ✅ (warnings preexistentes em `triage/home/page.tsx`: `no-explicit-any`)
- Documentation:
- `wiki/changelog/2026-03-04-stopwatch-visible-all-ticket-surfaces.md`

---

# Task: Refresh estético sem azul na interface (paleta moderna)
**Status**: completed
**Started**: 2026-03-04T18:10:00-05:00

## Plan
- [x] Step 1: Mapear tokens de tema e hardcodes azuis na UI principal de triagem.
- [x] Step 2: Substituir paleta base para acento `sage/slate` e fundos claros neutros.
- [x] Step 3: Remover hardcodes azuis residuais em sidebar/chat/playbook/triage.
- [x] Step 4: Validar com lint/typecheck do web.
- [x] Step 5: Documentar na wiki/changelog.

## Progress Notes
- Tokens centrais em `apps/web/src/styles/globals.css` foram trocados de azul para `--accent` verde-acinzentado (`#6F8F7E`) com derivados (`--accent-muted`, `--border-accent`, glows).
- Tema claro foi neutralizado (menos azulado) com novos fundos/textos para aparência mais moderna e limpa.
- Hardcodes azuis removidos nos fluxos de triagem/chat/sidebar/playbook e substituídos por variáveis de tema.

## Review
- Verification:
- `pnpm --filter @cerebro/web typecheck` ✅
- `pnpm --filter @cerebro/web lint` ✅ (apenas warnings preexistentes em `triage/home/page.tsx`: `no-explicit-any`)
- Documentation:
- `wiki/changelog/2026-03-04-ui-modern-theme-no-blue-sage-slate-refresh.md`

---

# Task: Corrigir warning de form field sem id/name
**Status**: completed
**Started**: 2026-03-04T17:18:00-05:00

## Plan
- [x] Step 1: Identificar campos com warning de `id/name` ausente.
- [x] Step 2: Adicionar `id` e `name` em inputs afetados.
- [x] Step 3: Validar com typecheck web.
- [x] Step 4: Documentar na wiki/changelog.

## Progress Notes
- Foram corrigidos campos de input em `ChatInput`, `ProfileModal` e `StatusEditorModal`.
- Mudança sem impacto de lógica/fluxo, focada em semântica de formulário e compatibilidade de autofill.

## Review
- Verification:
- `pnpm --filter @cerebro/web typecheck` ✅
- Documentation:
- `wiki/changelog/2026-03-04-form-field-id-name-accessibility-fix.md`

---

# Task: Gate de fetch por conector ativo (multi-PSA)
**Status**: completed
**Started**: 2026-03-04T17:05:00-05:00

## Plan
- [x] Step 1: Identificar chamadas de integração disparadas sem verificação de conector ativo.
- [x] Step 2: Implementar guarda compartilhada no client HTTP para bloquear requests de conectores inativos.
- [x] Step 3: Migrar sidebar para usar client gated (removendo fetch direto de `/autotask/queues`).
- [x] Step 4: Validar com typecheck e varredura estática de chamadas Autotask.
- [x] Step 5: Documentar na wiki/changelog.

## Progress Notes
- `p0-ui-client` agora resolve capabilities por tenant via `/integrations/credentials` (cache TTL 30s) e bloqueia requests para conectores conhecidos inativos (`autotask`, `connectwise`, `halo`, `itglue`, `kaseya`, `ninjaone`, `syncro`).
- Requests bloqueados falham localmente com `HttpError 503 connector_inactive`, sem chamada ao endpoint do conector.
- `useSidebarState` deixou de usar `fetch` direto para `/autotask/queues`; agora consome `listAutotaskQueues()` pelo client gated.

## Review
- Verification:
- `pnpm --filter @cerebro/web typecheck` ✅
- `rg -n "fetch\\(\\`\\$\\{API\\}/autotask|/api/autotask" apps/web/src -S` ✅ (sem fetch direto restante)
- Documentation:
- `wiki/changelog/2026-03-04-connector-active-gating-multi-psa-fetch.md`

---

# Task: Canonical pass-through Autotask -> Workflow Inbox -> Sidebar/Context (sem enrichment tardio)
**Status**: completed
**Started**: 2026-03-04T12:20:00-05:00

## Plan
- [x] Step 1: Remover enrichment de sync por `fetchTicketSnapshot` para campos canônicos de sidebar/contexto.
- [x] Step 2: Persistir no `domain_snapshots.tickets` os campos canônicos do payload Autotask (IDs/labels e identidade).
- [x] Step 3: Remover sweep de backfill canônico no poller para evitar overwrite tardio na UI.
- [x] Step 4: Priorizar no frontend os campos canônicos vindos de `/workflow/inbox` e parar resolução em background por metadata para render principal.
- [x] Step 5: Atualizar testes do workflow core para o novo contrato de pass-through.
- [x] Step 6: Rodar validações (`api test`, `api/web typecheck`, `web lint`) e documentar na wiki.

## Progress Notes
- `processAutotaskSyncEvent` deixou de buscar snapshot remoto para preencher company/requester/status/queue/created_at durante sync; agora persiste o que chega no evento canônico + estado já existente.
- `normalizeEventDomainSnapshots` passou a mapear explicitamente `company_id`, `contact_id`, `priority`, `issue_type`, `sub_issue_type`, `sla` e labels associados quando presentes no payload.
- O poller removeu o `backfillCanonicalIdentity` pós-loop, eliminando mutação tardia que podia alterar card/contexto após render inicial.
- A tela de triagem passou a usar labels/IDs canônicos do sidebar ticket para Priority/Issue/Sub-Issue/SLA e removeu prefetch de `/autotask/ticket-field-options` para renderização passiva.

## Review
- Verification:
- `pnpm --filter @cerebro/api test -- ticket-workflow-core.test.ts` ✅ (24/24)
- `pnpm --filter @cerebro/api test -- autotask-polling.test.ts` ✅ (7/7)
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/web typecheck` ✅
- `pnpm --filter @cerebro/web lint` ✅ (warnings preexistentes em `triage/home/page.tsx`)
- Documentation:
- `wiki/changelog/2026-03-04-autotask-canonical-pass-through-no-sync-enrichment.md`

---

# Task: Hotfix sidebar jitter (scroll lock race + skeleton eterno)
**Status**: completed
**Started**: 2026-03-04T11:45:00-05:00

## Plan
- [x] Step 1: Mitigar storm de requests em `/workflow/inbox` causado por bursts de realtime.
- [x] Step 2: Tornar animação FLIP da sidebar scroll-aware para não disputar scroll do usuário.
- [x] Step 3: Remover skeleton “eterno” por card com fallback estável quando canônico não chega rapidamente.
- [x] Step 4: Executar validação completa (`lint`, `typecheck`, `test`).
- [x] Step 5: Atualizar wiki/changelog obrigatório.

## Progress Notes
- `usePollingResource` agora coalesceu bursts de `ticket.change` (debounce), serializa fetches in-flight e evita fanout concorrente.
- `ChatSidebar` passou a pular animação de reorder quando há scroll ativo ou deltas de layout suspeitos, removendo a disputa de rolagem.
- A adaptação de tickets para sidebar agora sanitiza placeholders `Unknown ...`; skeleton só aparece quando o ticket está em janela recente de pendência canônica.
- Fora dessa janela, campos ausentes mostram `—` estável em vez de shimmer infinito.

## Review
- Verification:
- `pnpm -r lint` ✅ (sem erros; warnings preexistentes)
- `pnpm -r typecheck` ✅
- `pnpm -r test` ✅
- Documentation:
- `wiki/changelog/2026-03-04-sidebar-scroll-race-and-canonical-skeleton-timebox.md`

---

# Task: Canonical-first sidebar rendering (remover hidratação no GET e fallback Unknown na UI)
**Status**: completed
**Started**: 2026-03-04T10:35:00-05:00

## Plan
- [x] Step 1: Remover hidratação durante `listInbox` (`GET /workflow/inbox`) para read-path estritamente canônico/read-only.
- [x] Step 2: Ajustar testes do workflow core para o novo contrato canonical-first (sem fetch/hydration em leitura).
- [x] Step 3: Eliminar fallback textual `Unknown` na sidebar/contexto para Org/Requester/Issue/Sub-Issue/Priority/SLA.
- [x] Step 4: Garantir estado visual explícito de loading/skeleton quando campos não estão presentes.
- [x] Step 5: Executar gates de validação (`pnpm -r lint`, `pnpm -r typecheck`, `pnpm -r test`).
- [x] Step 6: Atualizar wiki/changelog obrigatório.

## Progress Notes
- `listInbox` deixou de chamar `hydrateMissingOrgRequester`; o GET agora só retorna o read-model já materializado.
- Testes que assumiam hidratação no read-path foram migrados para validar comportamento read-only.
- UI da sidebar/contexto foi ajustada para não renderizar texto `Unknown`; quando faltam valores, renderiza vazio/skeleton em vez de placeholder textual.

## Review
- Verification:
- `pnpm -r lint` ✅ (sem erros; warnings preexistentes)
- `pnpm -r typecheck` ✅
- `pnpm -r test` ✅
- Documentation:
- `wiki/changelog/2026-03-04-canonical-first-sidebar-read-model-no-get-hydration.md`

---

# Task: Canonical-first no write-path do workflow inbox (eliminar persistência de payload parcial)
**Status**: completed
**Started**: 2026-03-04T09:40:00-05:00

## Plan
- [x] Step 1: Investigar por que `/workflow/inbox` ainda publica dados errados mesmo com polling.
- [x] Step 2: Implementar enriquecimento canônico no `processAutotaskSyncEvent` antes do `upsertInboxTicket`.
- [x] Step 3: Evitar persistência de status numérico/placeholder quando snapshot canônico está disponível.
- [x] Step 4: Adicionar regressão cobrindo evento parcial do poller (sem org/requester/status label).
- [x] Step 5: Executar testes/typecheck da superfície alterada.
- [x] Step 6: Atualizar wiki/changelog obrigatório.

## Progress Notes
- O write-path de sync aceitava payload parcial do poller como “verdade” e só corrigia depois via hidratação no read-path.
- Agora o sync faz canonicalização antes de persistir: busca snapshot Autotask quando faltam campos canônicos (org/requester/created_at/status label) ou quando status vem como código numérico.
- Resultado: a linha já entra no inbox com dados canônicos, reduzindo race/fallback na sidebar.

## Review
- Verification:
- `pnpm --filter @cerebro/api test -- ticket-workflow-core.test.ts` ✅ (24/24)
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/web typecheck` ✅
- Documentation:
- `wiki/changelog/2026-03-04-canonical-first-workflow-inbox-write-path.md`

---

# Task: Corrigir unknown persistente no topo da sidebar + persistir cache local de hidratação
**Status**: completed
**Started**: 2026-03-04T11:10:00-05:00

## Plan
- [x] Step 1: Investigar por que tickets recentes continuam `Unknown` mesmo com polling.
- [x] Step 2: Corrigir dedupe de aliases para não preservar placeholders quando existe valor canônico.
- [x] Step 3: Persistir cache de leitura no cliente para sobreviver reload/login.
- [x] Step 4: Ajustar TTL do cache de inbox para reduzir refetch agressivo.
- [x] Step 5: Rodar testes/typecheck de API/Web.
- [x] Step 6: Atualizar wiki/changelog obrigatório.

## Progress Notes
- Root cause confirmado: no merge de aliases (`listInbox`), `Unknown org/requester` era tratado como valor válido e bloqueava overwrite por outra linha do mesmo ticket com dados reais.
- Correção aplicada com seleção de valor significativo no dedupe.
- Cache local client-side agora persiste em `localStorage` para recursos críticos (`/workflow/inbox`, queues e field options), com hidratação no boot + TTL/stale.
- `listWorkflowInbox` teve janela de cache ampliada para reduzir re-fetchs frequentes após login/reload.

## Review
- Verification:
- `pnpm --filter @cerebro/api test -- ticket-workflow-core.test.ts` ✅ (23/23)
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/web typecheck` ✅
- Documentation:
- `wiki/changelog/2026-03-04-sidebar-top-unknown-dedupe-fix-and-persistent-read-cache.md`

---

# Task: Corrigir landing pós-login para fila Personal sem ticket selecionado
**Status**: completed
**Started**: 2026-03-04T10:35:00-05:00

## Plan
- [x] Step 1: Identificar por que `/triage/home` abre em modo draft por padrão.
- [x] Step 2: Alterar default para modo inbox (sem draft ativo) no acesso direto pós-login.
- [x] Step 3: Manter criação de ticket apenas quando usuário clicar `New Ticket`.
- [x] Step 4: Forçar escopo inicial `personal` via URL no redirect pós-login.
- [x] Step 5: Rodar typecheck web/api.
- [x] Step 6: Atualizar wiki/changelog obrigatório.

## Progress Notes
- Root cause: `/triage/home` sempre tratava a workspace de new-ticket como ativa (`isActive` default `true`) e passava `draftTicket + currentTicketId='__draft__'` para a sidebar.
- Correção:
  - modo compose só ativa via bridge ou `?compose=1`;
  - acesso padrão em `/triage/home` agora renderiza estado “sem seleção”;
  - botão `New Ticket` na home liga `compose=1`;
  - redirects pós-auth agora usam `?sidebarScope=personal`;
  - restore do sidebar state passou a priorizar `sidebarScope` da URL sobre sessão.

## Review
- Verification:
- `pnpm --filter @cerebro/web typecheck` ✅
- `pnpm --filter @cerebro/api typecheck` ✅
- Documentation:
- `wiki/changelog/2026-03-04-post-login-personal-queue-no-active-draft.md`

---

# Task: Priorizar hidratação por recência + animação live de reorganização da sidebar
**Status**: completed
**Started**: 2026-03-04T10:10:00-05:00

## Plan
- [x] Step 1: Priorizar candidatos de hidratação do inbox do mais recente para o mais antigo.
- [x] Step 2: Implementar animação de reorganização dos cards na sidebar com auto-update.
- [x] Step 3: Rodar typecheck API/Web e testes do core de workflow.
- [x] Step 4: Atualizar wiki/changelog obrigatório.

## Progress Notes
- Backend: `hydrateMissingOrgRequester` agora ordena candidatos faltantes por recência (`created_at` válido, fallback `updated_at`) antes do batch round-robin.
- Frontend: `ChatSidebar` recebeu animação FLIP de reorder para auto-update do polling (cards movem com transição suave quando dados canônicos chegam e a ordem muda).
- Não houve mudança de contrato público de API.

## Review
- Verification:
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/web typecheck` ✅
- `pnpm --filter @cerebro/api test -- ticket-workflow-core.test.ts` ✅ (22/22)
- Documentation:
- `wiki/changelog/2026-03-04-hydration-recency-priority-and-live-sidebar-reorder.md`

---

# Task: Corrigir hidratação sistêmica de placeholders no inbox (Unknown org/requester/status/assignee)
**Status**: completed
**Started**: 2026-03-04T09:05:00-05:00

## Plan
- [x] Step 1: Auditar filtro de candidatos da hidratação no `workflow inbox`.
- [x] Step 2: Tratar placeholders/sentinelas como campos faltantes para entrar no backfill.
- [x] Step 3: Corrigir merge de snapshot remoto para priorizar valor significativo (não placeholder).
- [x] Step 4: Adicionar teste de regressão para linha com `Unknown ...`.
- [x] Step 5: Executar typecheck + testes de `ticket-workflow-core`.
- [x] Step 6: Atualizar wiki/changelog obrigatório.

## Progress Notes
- Root cause confirmado: o filtro de hidratação só considerava string vazia como missing; valores `Unknown org`, `Unknown requester`, `-`, `Unassigned` ficavam fora da hidratação.
- Merge remoto também priorizava o valor atual da linha (placeholder), bloqueando overwrite pelo snapshot Autotask.
- Ajuste aplicado no core:
  - `needsInboxHydration(row)` agora considera placeholders/sentinelas;
  - merge remoto passou a usar `selectFirstMeaningful(...)`, ignorando placeholders.
- Regressão coberta com teste dedicado em `ticket-workflow-core.test.ts`.

## Review
- Verification:
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/api test -- ticket-workflow-core.test.ts` ✅ (21/21)
- Documentation:
- `wiki/changelog/2026-03-04-inbox-placeholder-hydration-systemic-fix.md`

---

# Task: Corrigir bloqueio de hidratação quando domain_snapshots contém placeholders
**Status**: completed
**Started**: 2026-03-04T09:35:00-05:00

## Plan
- [x] Step 1: Verificar se `domain_snapshots` com placeholders está marcando ticket como “hidratado”.
- [x] Step 2: Ignorar placeholders também na promoção local de snapshot.
- [x] Step 3: Adicionar regressão cobrindo snapshot local contaminado (`Unknown ...`).
- [x] Step 4: Rodar typecheck e suite de `ticket-workflow-core`.
- [x] Step 5: Atualizar wiki/changelog obrigatório.

## Progress Notes
- Root cause confirmado: promoção local (`existingSnapshot*`) usava `selectFirstNonEmpty`, aceitando `Unknown org/requester`, `-` e `Unassigned` como válidos.
- Com isso, o ticket era marcado como hidratado e pulava o fetch remoto do Autotask, travando o fallback no card.
- Ajuste aplicado para usar `selectFirstMeaningful(...)` também na etapa de promoção local de `domain_snapshots`.
- Teste novo cobre exatamente esse cenário e garante overwrite remoto correto.

## Review
- Verification:
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/api test -- ticket-workflow-core.test.ts` ✅ (22/22)
- Documentation:
- `wiki/changelog/2026-03-04-inbox-domain-snapshot-placeholder-guard.md`

---

# Task: Criar skill cerebro-team no projeto Cerebro a partir do pacote enviado
**Status**: completed
**Started**: 2026-03-04T07:25:00-05:00

## Plan
- [x] Step 1: Inspecionar `cerebro-team.zip` e `skill-creator` para validar estrutura alvo.
- [x] Step 2: Copiar skill para `.codex/skills/cerebro-team` removendo artefatos de zip/macOS.
- [x] Step 3: Ajustar frontmatter do `SKILL.md` para padrão mínimo (`name`, `description`).
- [x] Step 4: Verificar estrutura final do skill no repositório.
- [x] Step 5: Documentar mudança obrigatória na wiki/changelog.

## Progress Notes
- Skill importado de `cerebro-team.zip` para `.codex/skills/cerebro-team`.
- Arquivos `.DS_Store` removidos.
- `SKILL.md` normalizado para frontmatter simples e compatível com os demais skills do repositório.
- Estrutura `references/` preservada com playbooks, docs e exemplos.

## Review
- Verification:
- `find .codex/skills/cerebro-team -type f` ✅
- `sed -n '1,120p' .codex/skills/cerebro-team/SKILL.md` ✅
- Documentation:
- `wiki/changelog/2026-03-04-cerebro-team-skill-import.md`

---

# Task: Corrigir ausência de queues reais (evitar 200 vazio silencioso)
**Status**: completed
**Started**: 2026-03-03T18:45:00-05:00

## Plan
- [x] Step 1: Confirmar ponto de falha no fluxo `/autotask/queues` + sidebar queue catalog.
- [x] Step 2: Ajustar backend para não responder `success=true` com lista vazia quando provider falha e não há cache.
- [x] Step 3: Ajustar frontend para não sobrescrever catálogo com `[]`.
- [x] Step 4: Rodar typecheck API/Web.
- [x] Step 5: Atualizar wiki/changelog.

## Progress Notes
- Backend: `GET /autotask/queues` agora retorna `503` (`Queue catalog unavailable`) quando o provider degrada e não existe cache válido, eliminando “falso sucesso” com payload vazio.
- Frontend sidebar: fetch de queue catalog ignora resposta normalizada vazia, preservando estado/catálogo anterior e fallback estável.

## Review
- Verification:
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/web typecheck` ✅
- Documentation:
- `wiki/changelog/2026-03-03-queue-catalog-no-silent-empty-success.md`

---

# Task: Implementar cache robusto (backend Redis/memory + frontend dedupe/SWR) para reduzir live pulls do Autotask
**Status**: completed
**Started**: 2026-03-03T18:20:00-05:00

## Plan
- [x] Step 1: Consolidar serviço de cache distribuído tenant-scoped com cache-aside, stale-while-revalidate, singleflight local e lock distribuído.
- [x] Step 2: Integrar cache em rotas Autotask de metadata/search (`ticket-draft-defaults`, `queues`, `companies/contacts/resources search`).
- [x] Step 3: Integrar cache curto no `GET /workflow/inbox` e invalidar domínio `workflow` em writes relevantes.
- [x] Step 4: Remover bypass agressivo `_ts` do polling de full-flow e adicionar cache client-side com dedupe + SWR no `p0-ui-client`.
- [x] Step 5: Executar validações de tipagem/testes relevantes.
- [x] Step 6: Atualizar documentação obrigatória na wiki.

## Open Questions
- Nenhuma.

## Progress Notes
- Serviço `DistributedCacheService` criado em `apps/api/src/services/cache/distributed-cache.ts` com:
- chaves versionadas tenant/domain/resource + fingerprint estável;
- backend Redis preferencial com fallback memory;
- cache-aside + stale-while-revalidate;
- singleflight local + lock distribuído (`SET NX PX`);
- invalidação por tag set (`invalidateByTag`) sem uso de `KEYS`;
- circuit breaker básico para falhas de backend de cache.
- Rotas Autotask de leitura passaram a usar cache tenant-scoped:
- `GET /autotask/ticket-draft-defaults`
- `GET /autotask/queues`
- `GET /autotask/companies/search`
- `GET /autotask/contacts/search`
- `GET /autotask/resources/search`
- `GET /workflow/inbox` agora usa cache curto (`ttl=10s`, `stale=60s`) e retorna `cache` meta no envelope.
- Invalidação tenant-wide por domínio `workflow` aplicada após:
- `POST /workflow/commands`
- `POST /workflow/commands/process`
- `POST /workflow/sync/autotask`
- `POST /workflow/reconcile/:ticketId`
- Frontend:
- removido `_ts=Date.now()` das chamadas de `full-flow` em `triage/[id]/page.tsx`;
- `p0-ui-client` ganhou cache local para GET com fresh/stale windows e dedupe de requests in-flight;
- endpoints de metadata/search/inbox migrados para usar esse cache client-side.

## Review
- What worked:
- Redução direta de tráfego live em metadata/search/inbox, com isolamento por tenant preservado.
- What was tricky:
- Garantir comportamento degradado sem quebrar UX quando não há cache prévio (retorno controlado em rotas read-only).
- Verification:
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/web typecheck` ✅
- `pnpm --filter @cerebro/api test -- --runInBand src/__tests__/services/ticket-workflow-core.test.ts` ✅ (18/18)
- `pnpm --filter @cerebro/api test -- --runInBand src/__tests__/services/read-model-fetchers-credentials.test.ts` ✅ (5/5)
- Observação: `src/__tests__/services/autotask-route-handlers.sidebar-coordination.test.ts` ficou pendurado no runner local (sem conclusão), já ocorria com este contexto de runtime/Jest ao importar o módulo de rota completo; não foi usado como gate de conclusão desta entrega.
- Documentation:
- `wiki/changelog/2026-03-03-distributed-cache-autotask-workflow-and-frontend-dedupe.md`

---

# Task: Hotfix regressão de carregamento (fallback geral) após hidratação em massa
**Status**: completed
**Started**: 2026-03-03T19:05:00-05:00

## Plan
- [x] Step 1: Isolar regressão no caminho `listInbox -> hydrateMissingOrgRequester`.
- [x] Step 2: Separar hidratação local (snapshot) de hidratação remota (provider) para reduzir latência crítica.
- [x] Step 3: Limitar hidratação remota com batch e timeout por ticket.
- [x] Step 4: Ajustar teste de regressão para configuração de batch remoto.
- [x] Step 5: Executar testes/checks relevantes.
- [x] Step 6: Atualizar wiki obrigatória com impacto e validação.

## Open Questions
- Nenhuma.

## Progress Notes
- Regressão identificada: hidratação remota ampliada no `listInbox` passou a competir com o tempo de resposta da rota sob backlog alto.
- Hotfix aplicado:
  - promoção imediata de `company_name/requester_name` de `domain_snapshots` sem round-trip externo;
  - hidratação remota limitada por `P0_WORKFLOW_INBOX_HYDRATION_REMOTE_BATCH_SIZE` (default 25);
  - timeout curto por ticket remoto `P0_WORKFLOW_INBOX_HYDRATION_REMOTE_TIMEOUT_MS` (default 1500ms).
- Resultado: rota de inbox volta a responder de forma estável mesmo com backlog, sem depender de longos blocos de fetch remoto.

## Review
- What worked:
- Correção localizada em `ticket-workflow-core`, preservando contrato do endpoint.
- What was tricky:
- Balancear cobertura de backfill com latência da rota crítica.
- Verification:
- `pnpm --filter @cerebro/api test -- src/__tests__/services/ticket-workflow-core.test.ts` ✅ (18/18)
- `pnpm --filter @cerebro/api typecheck` ✅
- Documentation:
- `wiki/changelog/2026-03-03-workflow-inbox-hydration-regression-hotfix.md`

---

# Task: Corrigir Unknown org/requester em massa no workflow inbox/sidebar
**Status**: completed
**Started**: 2026-03-03T18:35:00-05:00

## Plan
- [x] Step 1: Confirmar causa raiz no fluxo `workflow inbox -> hydrateMissingOrgRequester`.
- [x] Step 2: Remover gargalo fixo de 25 tickets e implementar hidratação em lote com concorrência controlada.
- [x] Step 3: Reaproveitar `domain_snapshots` antes de chamar provider externo.
- [x] Step 4: Adicionar teste de regressão para garantir cobertura acima de 25 itens.
- [x] Step 5: Executar testes/checks do backend.
- [x] Step 6: Atualizar wiki obrigatória com impacto e validação.

## Open Questions
- Nenhuma.

## Progress Notes
- Root cause confirmado: `hydrateMissingOrgRequester` limitava candidatos com `slice(0, 25)`, deixando backlog alto de tickets sem `company/requester`.
- Hidratação alterada para lote configurável (`P0_WORKFLOW_INBOX_HYDRATION_BATCH_SIZE`, default 250) com concorrência limitada (`P0_WORKFLOW_INBOX_HYDRATION_CONCURRENCY`, default 5).
- Antes de chamar `fetchTicketSnapshot`, o fluxo agora promove `company_name/requester_name` já existentes em `domain_snapshots`.
- Teste de regressão adicionado para validar preenchimento de 30 tickets faltantes (acima do cap legado de 25).

## Review
- What worked:
- Mudança localizada no core do workflow inbox, sem alterar contrato público de rota.
- What was tricky:
- Aumentar cobertura sem fanout irrestrito; solução adotada usa limite de concorrência explícito.
- Verification:
- `pnpm --filter @cerebro/api test -- src/__tests__/services/ticket-workflow-core.test.ts` ✅ (18/18)
- `pnpm --filter @cerebro/api typecheck` ✅
- Documentation:
- `wiki/changelog/2026-03-03-workflow-inbox-mass-org-requester-hydration.md`

---

# Task: Corrigir ordenação cronológica da sidebar (personal/global) por data real do ticket
**Status**: completed
**Started**: 2026-03-03T17:02:00-05:00

## Plan
- [x] Step 1: Confirmar causa raiz no fluxo `workflow/inbox -> workflow-sidebar-adapter -> useSidebarState`.
- [x] Step 2: Propagar/preservar `created_at` real no backend do workflow inbox.
- [x] Step 3: Ajustar adapter da sidebar para priorizar `created_at` real e fallback determinístico.
- [x] Step 4: Adicionar teste de regressão para `created_at` explícito + fallback por ticket number.
- [x] Step 5: Executar testes/checks relevantes.
- [x] Step 6: Atualizar wiki obrigatória com impacto e validação.

## Open Questions
- Nenhuma.

## Progress Notes
- Root cause confirmado: adapter da sidebar usava `updated_at/last_event` como `created_at`, e o workflow inbox não preservava data de criação real de forma robusta.
- Backend atualizado para carregar/preservar `created_at` (payload/snapshot/fallback por `ticket_number`).
- Frontend atualizado para consumir `row.created_at` com fallback consistente.
- Teste de regressão adicionado em `apps/api/src/__tests__/services/ticket-workflow-core.test.ts`.

## Review
- What worked:
- Correção pequena e isolada no fluxo de data (`created_at`) sem alterar contratos de auth/tenant/integração write.
- What was tricky:
- Preservar `created_at` em syncs subsequentes sem quebrar a ordenação já baseada em `updated_at` no backend.
- Verification:
- `pnpm --filter @cerebro/api test -- src/__tests__/services/ticket-workflow-core.test.ts` ✅ (17/17)
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/web typecheck` ✅
- Documentation:
- `wiki/changelog/2026-03-03-sidebar-chronological-order-created-at.md`

---

# Task: Corrigir colapso concorrente em /autotask/sidebar-tickets sob 429 thread-threshold
**Status**: completed
**Started**: 2026-03-03T17:45:00-05:00

## Plan
- [x] Step 1: Confirmar causa raiz no handler `/autotask/sidebar-tickets` e definir comportamento degradado determinístico para falhas 429/provider.
- [x] Step 2: Implementar fallback read-only sem 500 (cache válido quando existir; caso contrário lista vazia com sinalização `degraded`).
- [x] Step 3: Adicionar teste de regressão para garantir resposta estável em saturação do provider.
- [x] Step 4: Executar checks do `@cerebro/api` para validar tipagem e regressão.
- [x] Step 5: Atualizar wiki obrigatória com impacto técnico e evidência de verificação.

## Open Questions
- Assumption aplicada: para endpoint read-only de sidebar, responder `200` com `degraded` + dados parciais/vazios é preferível a `500` durante falha transitória do provider.

## Progress Notes
- Bug reproduzido por evidência de runtime: `Autotask API error: 429` com `thread threshold of 3 threads has been exceeded`.
- Causa raiz confirmada: rota `/autotask/sidebar-tickets` deixava exceções do provider subirem para `next(error)` e retornava `500` em cascata.
- Context7 (`/expressjs/express`) consultado para confirmar padrão de tratamento: fallback explícito no handler para erro esperado de dependência, `next(error)` para falha não esperada.
- Implementado fallback degradado com priorização de snapshot cache (incluindo stale) e fallback final para `[]` quando não há cache.
- Ajustada classificação para reconhecer padrão de erro `thread threshold` do Autotask como `rate_limited`.
- Corrigida amplificação no caminho com advisory lock: falha de provider agora não dispara segunda tentativa direta no mesmo request.
- Adicionado cooldown curto por chave tenant+queue para evitar rebatidas imediatas após `429`.

## Review
- What worked:
- Mudança pequena e localizada no handler, sem alterar contrato principal (`data`, `count`, `source`) e adicionando apenas envelope opcional `degraded`.
- What was tricky:
- Evitar mascarar erro interno; a degradação ficou restrita a classificação de dependência (`RATE_LIMIT`, `TIMEOUT`, `DEPENDENCY`).
- Verification:
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/api test -- --runInBand src/__tests__/routes/autotask.sidebar-tickets.degradation.test.ts` ✅ (2/2)
- Documentation:
- `wiki/changelog/2026-03-03-sidebar-tickets-rate-limit-degradation-cooldown.md`

# Task: Fix upstream amplification in autotask sidebar tickets coordination
**Status**: completed
**Started**: 2026-03-03T16:00:00-05:00

## Plan
- [x] Step 1: Confirm root cause in current cache/in-flight/advisory-lock flow
- [x] Step 2: Implement deterministic coordination retries before any direct upstream fallback
- [x] Step 3: Add focused regression test for lock-miss then coordinated retry
- [x] Step 4: Run relevant tests and capture verification evidence
- [x] Step 5: Update wiki/changelog using required template

## Open Questions
- None.

## Progress Notes
- Root cause confirmed: `try-lock -> single wait window -> direct fetch` still allowed duplicated upstream reads under inter-process contention.
- Implemented repeated lock-attempt loop with short cache-poll intervals before fallback.
- Added route-level test proving retry on initial lock miss with single upstream fetch execution.

## Review
- What worked:
- Minimal localized change in `autotask-route-handlers.ts` preserving existing contracts and cache behavior.
- What was tricky:
- Keeping availability fallback while strengthening cross-request coordination.
- Verification:
- `pnpm --filter @cerebro/api test -- autotask-route-handlers.sidebar-coordination.test.ts` ✅
- Documentation:
- `wiki/changelog/2026-03-03-autotask-sidebar-upstream-amplification-coordination.md`

---

# Task: RCA profundo + correção de fallback persistente (org/requester/status/tech e 304 no full-flow)
**Status**: completed
**Started**: 2026-03-03T19:05:00-05:00

## Plan
- [x] Step 1: Confirmar causa raiz no caminho `/workflow/inbox` + adapter sidebar + polling de `/playbook/full-flow`.
- [x] Step 2: Corrigir hidratação backend para preencher também `status/assigned/queue` e aliases (`contact_name/requester`).
- [x] Step 3: Corrigir frontend para tratar `304` de `/playbook/full-flow` sem entrar em estado de erro/fallback.
- [x] Step 4: Ajustar adapter da sidebar para consumir aliases de snapshots (requester/status/queue/assigned).
- [x] Step 5: Adicionar teste de regressão para hidratação de campos além de org/requester.
- [x] Step 6: Executar testes/typecheck e registrar documentação.

## Open Questions
- Nenhuma.

## Progress Notes
- Causa raiz confirmada em dois pontos:
- Polling da tela de triage tratava `304` como erro (Axios default), levando o estado para erro/fallback sem falha real de backend.
- Hidratação do inbox cobria essencialmente org/requester; campos de status/assignee/queue ficavam vazios quando vinham por aliases em snapshots.
- Backend atualizado para hidratar e promover `status`, `assigned_to`, `queue_id`, `queue_name` e aliases `contact_name/requester`.
- Frontend atualizado no adapter da sidebar para ler aliases equivalentes em `domain_snapshots`.
- Frontend atualizado no polling de `full-flow` para aceitar `304` sem quebrar a UI.

## Review
- What worked:
- Correções localizadas nos pontos de projeção e leitura de dados, sem alteração de contrato de autenticação/tenant/integration write.
- What was tricky:
- Distinguir falha real de backend de resposta condicional `304` e preservar comportamento de polling sem reintroduzir bypass agressivo.
- Verification:
- `pnpm --filter @cerebro/api test -- ticket-workflow-core.test.ts` ✅ (19/19)
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/web typecheck` ✅
- Documentation:
- `wiki/changelog/2026-03-03-fullflow-304-and-workflow-inbox-hydration-fix.md`

---

# Task: Correção end-to-end de divergências no ticket T20260303.0015 (status/sidebar/contexto/notas)
**Status**: completed
**Started**: 2026-03-03T21:05:00-05:00

## Plan
- [x] Step 1: Auditar payloads do `full-flow` e `workflow/inbox` contra campos visíveis nas 3 colunas da tela.
- [x] Step 2: Corrigir overlay autoritativo do Autotask para mapear IDs/labels de status/priority/issue/sub-issue/SLA com aliases.
- [x] Step 3: Corrigir recuperação de notes para feed central com fallback de ID (`id`/`ticketID`/`ticketId`).
- [x] Step 4: Reforçar seed de `autotask_authoritative` no prepare-context para reduzir lacunas sem refresh manual.
- [x] Step 5: Ajustar renderização frontend (timeline + status label/sidebar) para evitar fallback incorreto.
- [x] Step 6: Executar validações de tipagem/testes e registrar evidências.

## Open Questions
- Nenhuma.

## Progress Notes
- `full-flow` agora recebe overlay com normalização robusta de campos Autotask (snake/camel/case variants) e labels por picklist.
- Campo `priority` não usa mais fallback fixo `P3` quando existe dado autoritativo.
- Feed central agora recupera notes mesmo quando API retorna `ticketID` ao invés de `id`; também inclui `ticket.updates` como fallback de histórico.
- Sidebar workflow passou a priorizar `status_label` de snapshot para classificação visual, reduzindo mismatch de status.
- SSOT authoritative seed foi ampliado com status/priority/issue/sub-issue/SLA e secondary resource.

## Review
- What worked:
- Correção focada no path de dados (Autotask -> SSOT/full-flow -> UI), sem mudanças em auth/tenant boundaries.
- What was tricky:
- Harmonizar aliases heterogêneos da API Autotask sem quebrar contratos existentes.
- Verification:
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/web typecheck` ✅
- `pnpm --filter @cerebro/api test -- ticket-workflow-core.test.ts` ✅ (19/19)
- Documentation:
- `wiki/changelog/2026-03-03-fullflow-304-and-workflow-inbox-hydration-fix.md`

---

# Task: Correção de runtime não refletindo campos canônicos no T20260303.0015
**Status**: completed
**Started**: 2026-03-04T06:10:00-05:00

## Plan
- [x] Step 1: Revalidar sintomas reportados após deploy local e identificar ponto de falha ainda ativo.
- [x] Step 2: Corrigir obtenção de cliente Autotask no reviewer/full-flow para usar tenant explícito da request.
- [x] Step 3: Corrigir feed central para fallback adicional de updates e note-id variants.
- [x] Step 4: Sincronizar card da esquerda com snapshot canônico do ticket selecionado para eliminar `Unknown` residual.
- [x] Step 5: Restaurar fallback seguro de `priority/issue/sub-issue/sla/status` quando overlay autoritativo não retornar.
- [x] Step 6: Reexecutar typecheck/testes e reiniciar stack runtime.

## Open Questions
- Nenhuma.

## Progress Notes
- Causa operacional encontrada: camada reviewer do `full-flow` podia ficar sem tenant explícito e retornar vazio silenciosamente (impactando notes + campos contextuais).
- Ajuste aplicado para passar `req.auth.tid` explicitamente ao resolver cliente Autotask no overlay e notes feed.
- Card da esquerda agora é atualizado com dados canônicos já resolvidos no `full-flow` para o ticket ativo.
- Fallback de campos contextuais no `canonicalTicket` foi reforçado para evitar regressão de `Priority` em branco.
- Stack reiniciada após patch para garantir runtime consistente com o código atual.

## Review
- What worked:
- Correção direta no path efetivamente usado em runtime (`playbook-route-handlers` + page triage).
- What was tricky:
- Diferenciar falha de mapeamento de falha de contexto de tenant na camada reviewer.
- Verification:
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/web typecheck` ✅
- `pnpm --filter @cerebro/api test -- ticket-workflow-core.test.ts` ✅ (19/19)
- `pnpm stack:restart` ✅ (api/web healthy)
- Documentation:
- `wiki/changelog/2026-03-03-fullflow-304-and-workflow-inbox-hydration-fix.md`

---

# Task: Corrigir race condition de oscilação Unknown/real no card da sidebar
**Status**: completed
**Started**: 2026-03-04T06:45:00-05:00

## Plan
- [x] Step 1: Auditar concorrência entre polling da sidebar (`loadTriPaneSidebarTickets`) e patch canônico vindo do `full-flow`.
- [x] Step 2: Implementar merge determinístico de estado no frontend para evitar overwrite com valores degradados.
- [x] Step 3: Priorizar valores conhecidos sobre placeholders (`Unknown`, `Unassigned`, `-`) em campos críticos do card.
- [x] Step 4: Validar typecheck web/api e reiniciar runtime.

## Open Questions
- Nenhuma.

## Progress Notes
- Race confirmado: dois writers assíncronos atualizando `sidebarTickets` em cadências distintas (3s e 10s), gerando flip-flop visual entre dados canônicos e fallback.
- `fetchTickets` da página de triage passou a usar merge com estado anterior, em vez de replace direto.
- Merge agora preserva `org/requester/status label/priority/queue/assignee` quando o payload novo vier degradado.

## Review
- What worked:
- Fix localizado no writer da sidebar em `triage/[id]`, sem alterar contratos da API.
- What was tricky:
- Evitar “travar” dados antigos; merge mantém atualização quando novo valor é realmente melhor.
- Verification:
- `pnpm --filter @cerebro/web typecheck` ✅
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm stack:restart` ✅ (api/web healthy)
- Documentation:
- `wiki/changelog/2026-03-03-fullflow-304-and-workflow-inbox-hydration-fix.md`

---

# Task: Corrigir oscillation de status canônico vs evento de nota no mesmo card
**Status**: completed
**Started**: 2026-03-04T07:15:00-05:00

## Plan
- [x] Step 1: Isolar origem da alternância `Waiting Customer` <-> `Customer note added`.
- [x] Step 2: Bloquear labels de evento (`note/comment added`) como `ticket_status_label` canônico.
- [x] Step 3: Ajustar merge concorrente da sidebar para preservar status lifecycle válido.
- [x] Step 4: Validar typecheck e reiniciar stack.

## Open Questions
- Nenhuma.

## Progress Notes
- Root cause confirmado: writer do `full-flow` estava empurrando label de evento de nota para o campo de status do card.
- Regras novas no frontend:
- `isLifecycleStatusLabel` rejeita labels de evento (`note/comment added`, `workflow rule`).
- merge de sidebar só aceita status detalhado quando label é lifecycle; caso contrário preserva status anterior válido.

## Review
- What worked:
- Fix localizado no merge writer do `triage/[id]` sem alterar contrato da API.
- What was tricky:
- Evitar bloquear status legítimo textual e ao mesmo tempo impedir overwrite por evento operacional.
- Verification:
- `pnpm --filter @cerebro/web typecheck` ✅
- `pnpm stack:restart` ✅
- Documentation:
- `wiki/changelog/2026-03-03-fullflow-304-and-workflow-inbox-hydration-fix.md`

---

# Task: Corrigir race de horário no card (alternância 7:00 AM vs 6:32 PM)
**Status**: completed
**Started**: 2026-03-04T08:05:00-05:00

## Plan
- [x] Step 1: Reproduzir race temporal e confirmar writers concorrentes (`workflow inbox` vs `full-flow`).
- [x] Step 2: Tornar `created_at` determinístico no merge do card (preferir timestamp mais antigo/canônico).
- [x] Step 3: Remover fallback de `created_at` para `updated/last_event` no adapter da sidebar.
- [x] Step 4: Ajustar `full-flow` para priorizar `dbTicket.created_at` sobre `ssot.created_at`.
- [x] Step 5: Validar typecheck/teste e registrar documentação.

## Open Questions
- Nenhuma.

## Progress Notes
- Root cause confirmado: dois polls atualizavam o mesmo card com semânticas diferentes de tempo (`ticket created` vs `event processed`), causando flip-flop visual.
- `mergeSidebarTicketList` agora resolve `created_at` por regra temporal determinística (earliest ISO válido) e não por última resposta recebida.
- `workflow-sidebar-adapter` não usa mais `updated_at/last_event_occurred_at/last_sync_at` para preencher horário do card quando `created_at` está ausente.
- `full-flow` passou a usar `dbTicket.created_at` antes de `ssot.created_at` para reduzir contaminação por timestamps de processamento.

## Review
- What worked:
- Correção no ponto de concorrência de writers sem alterar contratos de API.
- What was tricky:
- Isolar timestamp canônico de ticket versus timestamp operacional de evento.
- Verification:
- `pnpm --filter @cerebro/web typecheck` ✅
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/api test -- ticket-workflow-core.test.ts` ✅ (19/19)
- `python3 .codex/skills/cerebro-concurrency-race-auditor/scripts/concurrency_hotspots.py` ✅
- Documentation:
- `wiki/changelog/2026-03-04-sidebar-created-at-race-fix.md`

---

# Task: Tornar horário de criação estritamente canônico do Autotask
**Status**: completed
**Started**: 2026-03-04T09:00:00-05:00

## Plan
- [x] Step 1: Auditar paths que preenchem `created_at` (sync event, gateway snapshot, full-flow, sidebar adapter).
- [x] Step 2: Priorizar aliases de criação do AT (`createDateTime/createDate`) no backend de workflow/sync.
- [x] Step 3: Remover fallback por `ticket_number` para horário (evitar `7:00 AM` sintético).
- [x] Step 4: Garantir overlay autoritativo no full-flow com `created_at` vindo do AT.
- [x] Step 5: Validar testes/typecheck e documentar.

## Open Questions
- Nenhuma.

## Progress Notes
- `processAutotaskSyncEvent` e projeções locais agora aceitam `createDateTime/createDate` como candidatos de `created_at`.
- Hidratação remota do inbox passa a preencher `created_at` via snapshot remoto (AT) quando ausente.
- Fallback baseado em `ticket_number` foi removido do backend (`inferCreatedAt`) e da sidebar adapter para impedir hora fabricada.
- Overlay autoritativo do full-flow agora inclui `created_at` do ticket remoto do Autotask.
- Poller de sync envia payload com `created_at`, `createDateTime` e `createDate`.

## Review
- What worked:
- Correção em cadeia inteira de origem/projeção para manter semântica única de “ticket creation time”.
- What was tricky:
- Conciliar robustez para payloads heterogêneos do AT sem reintroduzir fallback sintético.
- Verification:
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/web typecheck` ✅
- `pnpm --filter @cerebro/api test -- ticket-workflow-core.test.ts` ✅ (19/19)
- `python3 .codex/skills/cerebro-concurrency-race-auditor/scripts/concurrency_hotspots.py --json` ✅
- Documentation:
- `wiki/changelog/2026-03-04-autotask-canonical-created-at.md`

---

# Task: Exibir data+hora no card da sidebar (não apenas hora)
**Status**: completed
**Started**: 2026-03-04T09:35:00-05:00

## Plan
- [x] Step 1: Definir regra de UX para timestamp do card (hoje vs dias anteriores).
- [x] Step 2: Implementar no formatter compartilhado do sidebar.
- [x] Step 3: Executar gates de validação solicitados pelo playbook.
- [x] Step 4: Documentar mudança na wiki.

## Open Questions
- Nenhuma.

## Progress Notes
- `formatCreatedAt` agora mostra apenas hora para tickets de hoje.
- Para tickets de dias anteriores, mostra `MM/DD/YYYY HH:MM`.
- Campo `age` continua como fallback quando `created_at` não existe ou é inválido.

## Review
- What worked:
- Alteração localizada em util compartilhado sem mudar contrato de componentes.
- What was tricky:
- Garantir compatibilidade com fallback existente (`age`/`just now`).
- Verification:
- `pnpm -r lint` ✅ (somente warnings existentes no repositório)
- `pnpm -r typecheck` ✅
- `pnpm -r test` ❌ (falhas pré-existentes/independentes em `apps/api src/__tests__/routes/autotask.sidebar-tickets.test.ts`)
- Documentation:
- `wiki/changelog/2026-03-04-sidebar-card-date-time.md`

---

# Task: Corrigir hidratação sistêmica do inbox (sem abrir ticket individual)
**Status**: completed
**Started**: 2026-03-04T10:05:00-05:00

## Plan
- [x] Step 1: Auditar por que tickets antigos continuavam `Unknown` até abrir o ticket.
- [x] Step 2: Eliminar starvation no backfill de hidratação da listagem do inbox.
- [x] Step 3: Adicionar teste de regressão para rotação de candidatos em lotes.
- [x] Step 4: Validar typecheck/teste alvo e documentar.

## Open Questions
- Nenhuma.

## Progress Notes
- Root cause encontrado: seleção fixa por fatia inicial de candidatos podia repetir sempre os mesmos tickets com falha de snapshot/timeouts, impedindo cobertura do backlog completo.
- `hydrateMissingOrgRequester` agora usa seleção round-robin por tenant para os candidatos incompletos.
- Isso garante progresso sobre todo o conjunto (~milhares), sem depender de abrir o ticket na UI.
- Teste novo cobre starvation: mesmo com falhas recorrentes no início, tickets fora da primeira fatia passam a ser hidratados em ciclos seguintes.

## Review
- What worked:
- Correção localizada no path de listagem/hidratação (`workflow inbox`) com baixo risco de regressão funcional.
- What was tricky:
- Preservar limites de batch/timeout e tenant-scoping sem introduzir contenção global.
- Verification:
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/api test -- ticket-workflow-core.test.ts` ✅ (20/20)
- `python3 .codex/skills/cerebro-concurrency-race-auditor/scripts/concurrency_hotspots.py` ✅
- Documentation:
- `wiki/changelog/2026-03-04-inbox-hydration-round-robin-backfill.md`

---

# Task: Hotfix final de estabilidade da sidebar (sem shimmer eterno + sem disputa de scroll)
**Status**: completed
**Started**: 2026-03-04T11:25:00-05:00

## Plan
- [x] Step 1: Eliminar shimmer por campo em card de ticket (render estável para metadados ausentes).
- [x] Step 2: Remover animação de reordenação que aplicava transforms durante atualizações da lista.
- [x] Step 3: Priorizar campos canônicos Autotask para Org/Contact no triage.
- [x] Step 4: Evitar polling de inbox em tela de draft quando o draft está inativo.
- [x] Step 5: Validar web lint/typecheck e registrar documentação.

## Open Questions
- Nenhuma.

## Progress Notes
- `SidebarTicketCard` não exibe mais skeleton por campo (`company/requester`): agora renderiza valor canônico ou `—`.
- `ChatSidebar` deixou de aplicar FLIP de reordenação em DOM; lista passou para render estático sem transformação de `translateY`.
- `triage/[id]/page.tsx` passou a priorizar `data.ticket` (Autotask) para `Org` e `Contact`, reduzindo influência de heurísticas (`affected_user`) nesses campos.
- `ChatSidebar` no triage usa somente `isLoadingTickets` para loading da lista, desacoplado do loading do playbook.
- `triage/home/page.tsx` só faz polling de inbox quando `isActive` (draft realmente aberto), removendo polling em background oculto.

## Review
- What worked:
- Hotfix focado na causa visual e de concorrência sem alterar contratos públicos da API.
- What was tricky:
- Separar fallback UX (placeholder/skeleton) de fonte canônica sem quebrar navegação do triage.
- Verification:
- `pnpm --filter @cerebro/web typecheck` ✅
- `pnpm --filter @cerebro/web lint` ✅ (somente warnings preexistentes no arquivo)
- Documentation:
- `wiki/changelog/2026-03-04-sidebar-canonical-autotask-scroll-stability-hotfix.md`

---

# Task: Regressão de fetch no `/triage/home` (sidebar sem requests)
**Status**: completed
**Started**: 2026-03-04T12:05:00-05:00

## Plan
- [x] Step 1: Isolar causa de ausência de `GET /workflow/inbox` no `/triage/home`.
- [x] Step 2: Corrigir condição de polling para diferenciar modo embutido (draft layer) de rota standalone.
- [x] Step 3: Validar typecheck/lint no `@cerebro/web`.
- [x] Step 4: Atualizar documentação wiki.

## Progress Notes
- O guard `if (!isActive) return` bloqueava polling também na rota standalone (`/triage/home`).
- Ajuste aplicado com `shouldLoadSidebarTickets = !isEmbeddedWorkspace || isActive`.
- Resultado: standalone volta a carregar lista normalmente; modo embutido oculto continua sem polling.

## Review
- Verification:
- `pnpm --filter @cerebro/web typecheck` ✅
- `pnpm --filter @cerebro/web lint` ✅ (warnings preexistentes)
- Documentation:
- `wiki/changelog/2026-03-04-triage-home-sidebar-fetch-regression-fix.md`

---

# Task: Sidebar chronological ordering fix (Personal/Global)
**Status**: completed
**Started**: 2026-03-04T15:05:00-05:00

## Plan
- [x] Step 1: Identificar onde a ordenação da sidebar é aplicada para ambos os escopos.
- [x] Step 2: Tornar o ranking cronológico determinístico com fallback seguro quando `created_at` estiver ausente/inválido.
- [x] Step 3: Validar `@cerebro/web` com typecheck/lint.
- [x] Step 4: Registrar documentação da mudança na wiki.

## Progress Notes
- O sort anterior usava apenas `Date.parse(created_at)` e, sem timestamp válido, caía para ordem de chegada do array.
- Foi adicionado `resolveTicketChronology` para calcular ordem por precedência: `created_at` canônico -> data derivada de `ticket_number` (`TYYYYMMDD.*`) -> undated.
- Tie-break determinístico: presença de timestamp canônico e sequência do ticket (`.0001`, `.0018`, etc.).

## Review
- Verification:
- `pnpm --filter @cerebro/web typecheck` ✅
- `pnpm --filter @cerebro/web lint` ✅ (warnings preexistentes em `triage/home/page.tsx`)
- Documentation:
- `wiki/changelog/2026-03-04-sidebar-chronological-ordering-deterministic.md`

---

# Task: Polling parity non-complete with recency-first hydration
**Status**: completed
**Started**: 2026-03-04T15:20:00-05:00

## Plan
- [x] Step 1: Identificar por que tickets antigos aparecem antes da cobertura completa dos tickets recentes.
- [x] Step 2: Ajustar poller para processar não-complete priorizando mais recentes (global e por fila), com ordenação determinística por recência.
- [x] Step 3: Validar com testes alvo do poller + typecheck API.
- [x] Step 4: Atualizar wiki/changelog e finalizar review com evidências.

## Open Questions
- Nenhuma (requisito explícito: paridade em não-complete com hidratação recency-first).

## Progress Notes
- Diagnóstico confirmado: o poller fazia varredura por fila sem priorização global de recência e a coleta "recent" considerava apenas última 1h, podendo deixar tickets de hoje fora enquanto backlog antigo era ingerido.
- Implementação aplicada em `AutotaskPollingService`:
  - Janela recent configurável (`AUTOTASK_POLLER_RECENT_LOOKBACK_HOURS`, default 24h) com ordenação por recência.
  - Snapshot de paridade por fila em 2 fases (janela recente + backlog), merge/dedupe e ordenação recency-first.
  - Filtro de status terminal (Complete/Closed/Resolved/Done) por IDs de metadata + fallback textual.
  - Priorização explícita: ingestão recente primeiro, backlog depois.

## Review
- What worked:
- Mudança localizada no poller, sem alteração de contrato de API da sidebar.
- Verification:
- `pnpm --filter @cerebro/api test -- autotask-polling.test.ts` ✅ (7/7)
- `pnpm --filter @cerebro/api typecheck` ✅
- Documentation:
- `wiki/changelog/2026-03-04-polling-parity-non-complete-recency-first.md`

## Progress Notes (update)
- Root cause adicional identificado: o loop de polling aguardava `triageRun` sequencialmente por ticket, reduzindo throughput de ingestão e atrasando visibilidade de tickets recentes.
- Ajuste: ingestão de todos os tickets recentes ocorre primeiro; disparo de triage é feito depois, com concorrência controlada (`AUTOTASK_POLLER_TRIAGE_CONCURRENCY`, default 3), sem bloquear o preenchimento do inbox.

---

# Task: Unified queue/status controls for Personal and Global sidebar scopes
**Status**: completed
**Started**: 2026-03-04T18:10:00-05:00

## Plan
- [x] Step 1: Remover barra antiga de Personal (tabs ALL/PROCESSING/DONE/FAILED + toggle) e unificar layout de controles com Global.
- [x] Step 2: Implementar estado separado por escopo para seleção de fila e filtro de status (`personal` e `global`).
- [x] Step 3: Validar `@cerebro/web` (typecheck/lint/test).
- [x] Step 4: Documentar a mudança na wiki/changelog.

## Progress Notes
- `SidebarFilterBar` foi unificado: agora ambos os escopos usam `Queue` dropdown + botão de filtro de status.
- Foi adicionado estado de fila por escopo (`selectedPersonalQueue` + `selectedGlobalQueue`) e filtros de status por escopo (`personalHiddenStatusKeys` + `globalHiddenStatusKeys`).
- A filtragem de tickets no `useSidebarState` agora aplica a mesma mecânica de status (checkbox por status) em ambos os escopos, mantendo separação de itens por seção.

## Review
- Verification:
- `pnpm --filter @cerebro/web typecheck` ✅
- `pnpm --filter @cerebro/web lint` ✅ (warnings preexistentes fora do escopo em `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`)
- Documentation:
- `wiki/changelog/2026-03-04-sidebar-personal-global-unified-controls.md`

---

# Task: Dynamic Active counter reflects selected sidebar view
**Status**: completed
**Started**: 2026-03-04T18:26:00-05:00

## Plan
- [x] Step 1: Identificar origem do valor do counter em `SidebarStats`.
- [x] Step 2: Trocar para contagem dinâmica da lista visível após filtros atuais (scope + queue + status).
- [x] Step 3: Garantir que o menu de filtro continue funcional em Personal e Global.
- [x] Step 4: Validar `@cerebro/web` e documentar wiki.

## Progress Notes
- O valor exibido em `ACTIVE` agora deriva de `sortedVisible.length` (tickets realmente exibidos no recorte atual, sem draft).
- Ajuste adicional no `SidebarFilterBar`: popover de filtro fecha ao trocar escopo, mas abre/funciona em ambos os escopos.

## Review
- Verification:
- `pnpm --filter @cerebro/web typecheck` ✅
- `pnpm --filter @cerebro/web lint` ✅ (warnings preexistentes fora do escopo em `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`)
- `pnpm --filter @cerebro/web test` ✅
- Documentation:
- `wiki/changelog/2026-03-04-sidebar-dynamic-active-counter-by-selected-view.md`

---

# Task: Canonical JSON Pipeline v5 execution (consistência forte + UI blocos)
**Status**: completed
**Started**: 2026-03-05T09:30:00-05:00

## Plan
- [x] Step 1: Atualizar contratos/tipos V1 (event/snapshot/block states/pipeline status/command state).
- [x] Step 2: Estender workflow core para estados por bloco, status de pipeline, lag e prioridade determinística (tie-break + TTL first_seen_boost).
- [x] Step 3: Expor leitura por ticket em `/workflow/tickets/:id` e enriquecer payload de inbox sem quebrar compatibilidade.
- [x] Step 4: Cobrir com testes (service + route) para TTL, tie-break e semântica retry/DLQ em `pipeline_status`.
- [x] Step 5: Executar validação (`test`/`typecheck`) no escopo alterado.
- [x] Step 6: Documentar mudança na wiki (`/wiki/changelog`).

## Progress Notes
- Contratos V1 adicionados em `packages/types` e exportados no index.
- Workflow core passou a derivar estados A/B/C e `pipeline_status` por ticket, com `processing_lag_ms`, `retry_count`, `next_retry_at`, `dlq_id`, `consistent_at`.
- Warm queue com score composto determinístico + tie-break explícito + TTL de 15 minutos para `first_seen_boost`.
- Rotas novas implementadas: `GET /workflow/tickets/:ticketId`, `GET /workflow/tickets/:ticketId/commands`, `POST /workflow/tickets/:ticketId/reconcile` (compat com legado preservada).
- Client web (`p0-ui-client`) atualizado para snapshot/commands V1.

## Review
- Verification:
- `pnpm --filter @cerebro/types build` ✅
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/web typecheck` ✅
- `pnpm --filter @cerebro/api test -- src/__tests__/routes/workflow.reconcile-route.test.ts src/__tests__/services/ticket-workflow-core.test.ts` ✅
- Documentation:
- `wiki/changelog/2026-03-05-canonical-json-pipeline-v5-execution.md`

---

# Task: Fix stale Connected badge and enforce real Autotask health semantics
**Status**: completed
**Started**: 2026-03-05T10:25:00-05:00

## Plan
- [x] Step 1: Make Autotask health return `connected` only after real read path succeeds.
- [x] Step 2: Prevent stale `Connected` badge on Settings when health fetch fails.
- [x] Step 3: Validate with typecheck.
- [x] Step 4: Document in wiki changelog.

## Progress Notes
- Backend health check (`/integrations/health`) for Autotask now instantiates `AutotaskClient` and validates with `getTicketQueues` under timeout before returning `connected`.
- Health auth failures are normalized to explicit auth error detail.
- Settings `loadAll()` now clears `health`/`saved` snapshots on failed responses or network errors so stale UI state is not reused.

## Review
- Verification:
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/web typecheck` ✅
- Documentation:
- `wiki/changelog/2026-03-05-integrations-health-autotask-real-read-validation.md`

---

# Task: Autotask auth lockout mitigation + env credentials admin-only enforcement
**Status**: completed
**Started**: 2026-03-05T10:35:00-05:00

## Plan
- [x] Step 1: Enforce policy so only `admin@cerebro.local` can use Autotask env credentials.
- [x] Step 2: Remove tenant poller/workflow env fallback paths to fail closed on missing DB credentials.
- [x] Step 3: Add auth-failure cooldown in Autotask poller to prevent repeated 401 loops/lockouts.
- [x] Step 4: Prevent masked credential placeholders from being persisted on integration save.
- [x] Step 5: Validate with targeted tests/typechecks and document in wiki.

## Progress Notes
- Added centralized policy helper (`env-credential-policy`) and wired it into Autotask/env fallback paths in route handlers.
- Poller now enters explicit cooldown on authentication failures (`401/403/unauthorized/locked`) and skips immediate retry loops.
- Integration credential PUT now merges with existing stored values and ignores masked placeholders (`••••`) to avoid corrupting secrets/code.
- Settings UI save flow now avoids re-submitting masked placeholders and sends only meaningful values.

## Review
- Verification:
- `pnpm --filter @cerebro/api test -- autotask-polling.test.ts autotask.sidebar-tickets.test.ts integrations.credentials.test.ts env-credential-policy.test.ts` ✅
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/web typecheck` ✅
- Documentation:
- `wiki/changelog/2026-03-05-autotask-auth-lockout-and-env-credential-policy.md`

---

# Task: Remove all legacy intake references and filenames
**Status**: completed
**Started**: 2026-03-05T11:05:00-05:00

## Plan
- [x] Step 1: Rename runtime files/routes from legacy intake naming to `ticket-intake` and update imports/usages.
- [x] Step 2: Replace all legacy intake identifiers/strings with `ticket-intake` variants.
- [x] Step 3: Remove/rename legacy duplicate polling modules with old names.
- [x] Step 4: Update wiki/tasks references so repository has zero legacy intake mentions.
- [x] Step 5: Verify with grep + typecheck/tests and document changelog.

## Open Questions
- None. Execute full literal removal as requested.

## Review
- What changed:
- Renamed runtime files:
- `apps/api/src/routes/ingestion/ticket-intake.ts`
- `apps/api/src/services/application/route-handlers/ticket-intake-route-handlers.ts`
- `apps/api/src/services/adapters/ticket-intake-polling.ts`
- `apps/api/src/services/ticket-intake-polling.ts`
- Updated API mount/import in `apps/api/src/index.ts` to `/ticket-intake`.
- Replaced all repository occurrences of legacy intake variants (including wiki/task docs) with `ticket-intake`.
- Removed old compiled artifacts under `apps/api/dist` with legacy intake naming.

- Verification:
- `rg -n "ticket-intake|ticket_intake|TicketIntake|ticketIntake" apps/api/src apps/web/src wiki tasks` ✅
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/web typecheck` ✅
- `pnpm --filter @cerebro/api test -- autotask-polling.test.ts autotask.sidebar-tickets.test.ts integrations.credentials.test.ts env-credential-policy.test.ts` ✅

- Documentation:
- `wiki/changelog/2026-03-05-legacy-intake-naming-cleanup.md`

# Task: Incident fix — prevent Autotask credential lock from repeated auth attempts
**Status**: completed
**Started**: 2026-03-05T11:25:00-05:00

## Plan
- [x] Step 1: Map all active Autotask auth call paths and identify repeated-attempt vectors.
- [x] Step 2: Implement shared auth-failure cooldown at Autotask client layer (covers routes + poller).
- [x] Step 3: Add regression test to prove immediate repeat call does not hit provider after 401.
- [x] Step 4: Run focused tests + typecheck for changed surface.
- [x] Step 5: Update wiki changelog with incident RCA/fix details.

## Progress Notes
- Incident triage points to missing shared auth backoff across UI-driven endpoints (`/autotask/queues`, sidebar metadata reads) despite poller-level cooldown.
- `AutotaskClient` now enforces principal-level cooldown after auth failures, preventing repeated provider hits during lock/auth-invalid periods.
- Found production follow-up: cooldown keying by `username+integrationCode` kept 503 active even after secret rotation.
- Cooldown key now includes secret hash; saving Autotask credentials also clears cooldown for that exact principal+secret.

## Review
- Verification:
- `pnpm --filter @cerebro/integrations typecheck` ✅
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/api test -- autotask.test.ts` ✅
- `pnpm --filter @cerebro/api test -- autotask.sidebar-tickets.test.ts autotask.sidebar-tickets.degradation.test.ts` ✅ (warning de open handles preexistente)
- Additional incident verification:
- `pnpm --filter @cerebro/api test -- autotask.test.ts` ✅ (new regression: secret rotation bypasses stale cooldown)
- Documentation:
- `wiki/changelog/2026-03-05-autotask-shared-auth-cooldown-guard.md`

# Task: Flow A gating enforcement in sidebar cards (no render with missing core data)
**Status**: completed
**Started**: 2026-03-05T12:05:00-05:00

## Plan
- [x] Step 1: Identify where sidebar renders cards with missing core fields.
- [x] Step 2: Enforce canonical workflow-only source for global queue list path.
- [x] Step 3: Propagate core block state into sidebar ticket model.
- [x] Step 4: Render explicit resolving state instead of fallback dashes when Flow A is unresolved.
- [x] Step 5: Validate with web typecheck and document in wiki.

## Progress Notes
- Root cause confirmed: sidebar card rendering ignores `block_consistency.core_state` and falls back to `—` placeholders.
- Secondary cause confirmed: queue-specific global path could bypass canonical workflow read model by hitting `/autotask/sidebar-tickets` directly.

## Review
- Verification:
- `pnpm --filter @cerebro/web typecheck` ✅
- Documentation:
- `wiki/changelog/2026-03-05-sidebar-flow-a-gating-enforcement.md`

# Task: P0 incident — canonical hydration lag and stale show counter
**Status**: completed
**Started**: 2026-03-05T12:25:00-05:00

## Plan
- [x] Step 1: Trace Flow A data path from poller payload to workflow inbox projection.
- [x] Step 2: Remove poller blocking risk from identity enrichment (bounded lookup).
- [x] Step 3: Force fresh workflow inbox fetch in sidebar polling loop.
- [x] Step 4: Add regression test for slow identity lookup not blocking sync ingest.
- [x] Step 5: Validate with tests/typecheck and document in wiki.

## Progress Notes
- Root cause found: poller performed potentially large company/contact N+1 lookups before sync ingest, with unbounded `Promise.all`; under provider slowness/rate-limits this delayed `show`.
- Secondary root cause: sidebar periodic refresh could remain visually stale due cache path not forcing fresh fetch during polling loop.

## Review
- Verification:
- `pnpm --filter @cerebro/api test -- autotask-polling.test.ts` ✅
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/web typecheck` ✅
- Documentation:
- `wiki/changelog/2026-03-05-poller-identity-bounded-lookup-and-fresh-sidebar-inbox.md`

# Task: Fix workflow inbox parity drift against active Autotask tickets
**Status**: completed
**Started**: 2026-03-05T16:50:00-05:00

## Plan
- [x] Step 1: Measure live parity between `/workflow/inbox` and Autotask `status != Complete`.
- [x] Step 2: Identify why `Complete` tickets still remain in the inbox read model.
- [x] Step 3: Remove terminal tickets from inbox projection and parity purge.
- [x] Step 4: Add regressions for terminal filtering and purge behavior.
- [x] Step 5: Validate with tests/typecheck, restart stack, and re-measure live parity.
- [x] Step 6: Document in wiki changelog.

## Progress Notes
- Live measurement found drift: Cerebro `124` vs Autotask active `119`, with five tickets already `Complete` upstream still exposed by `/workflow/inbox`.
- Root cause: parity purge only removed `not found`; it did not remove tickets that still existed in Autotask but had already transitioned to a terminal status.
- Secondary hardening: `listInbox()` now drops rows whose local effective status is already terminal, so locally-complete tickets stop surfacing immediately.

## Review
- Verification:
- `pnpm --filter @cerebro/api test -- autotask-polling.test.ts ticket-workflow-core.test.ts` ✅
- `pnpm --filter @cerebro/api typecheck` ✅
- Live validation after restart: Cerebro inbox count matches active Autotask count for `status != Complete` ✅
- Documentation:
- `wiki/changelog/2026-03-05-workflow-inbox-active-parity-terminal-purge-fix.md`

# Task: Purge deleted Autotask tickets from workflow inbox on full-flow not-found
**Status**: completed
**Started**: 2026-03-05T17:35:00-05:00

## Plan
- [x] Step 1: Reproduce the stale ticket path for `T20260305.0031`.
- [x] Step 2: Confirm whether the API already receives a `ticket not found` signal from Autotask.
- [x] Step 3: Purge the inbox row and mark the session deleted when full-flow detects upstream deletion.
- [x] Step 4: Add route-level regressions for stale ticket removal.
- [x] Step 5: Validate with tests/typecheck, restart stack, and re-check live parity.
- [x] Step 6: Document in wiki changelog.

## Progress Notes
- API logs already showed `Ticket T20260305.0031 not found in Autotask query` during `prepare_context`, so the provider deletion signal existed before this fix.
- Root cause: the `full-flow` route handled the background failure as an operational error, but did not propagate that `not found` signal into workflow inbox purge or session terminalization.
- Runtime nuance found during live validation: `triage_sessions.status` does not allow `deleted`, so the session transition had to use the existing terminal state `failed` with a deletion-specific `last_error`.
- Fix: when the background path detects a missing Autotask ticket, remove it from the inbox read model and mark the `triage_session` as terminal without retries, tenant-scoped.

## Review
- Verification:
- `pnpm --filter @cerebro/api test -- playbook.full-flow-stale-ticket.test.ts autotask-polling.test.ts ticket-workflow-core.test.ts` ✅
- `pnpm --filter @cerebro/api typecheck` ✅
- Live validation after restart: `T20260305.0031` no longer appears in `/workflow/inbox`, and Cerebro active count matches Autotask active count ✅
- Documentation:
- `wiki/changelog/2026-03-05-full-flow-stale-autotask-ticket-purge-fix.md`

# Task: Stop triage sidebar status flip between full-flow and workflow inbox
**Status**: completed
**Started**: 2026-03-05T17:55:00-05:00

## Plan
- [x] Step 1: Measure live status payload mismatch for `T20260305.0037`.
- [x] Step 2: Confirm whether the UI merges status from both `/playbook/full-flow` and `/workflow/inbox`.
- [x] Step 3: Remove full-flow status mutation from the sidebar card state so queue status comes only from workflow inbox.
- [x] Step 4: Validate with web lint/typecheck and live behavior.
- [x] Step 5: Document in wiki changelog.

## Progress Notes
- Live evidence showed `/workflow/inbox` returning `New` while `/playbook/full-flow` returned `Complete` for the same ticket.
- Root cause: the triage ticket page rewrote the selected sidebar card status from `full-flow` every 3 seconds, while the sidebar itself refreshed canonical inbox data every 10 seconds.
- Fix: stop mutating `ticket_status_label/ticket_status_value` from `full-flow`; sidebar card status now remains owned by the workflow inbox adapter.

## Review
- Verification:
- `pnpm --filter @cerebro/web lint` ✅
- `pnpm --filter @cerebro/web typecheck` ✅
- Live validation: `T20260305.0037` no longer flips `New -> Complete -> New` in the sidebar card while the inbox remains stale ✅
- Documentation:
- `wiki/changelog/2026-03-05-triage-sidebar-status-source-of-truth-fix.md`

# Task: Reflect terminal PSA status in workflow inbox instead of purging Complete tickets
**Status**: completed
**Started**: 2026-03-05T18:20:00-05:00

## Plan
- [x] Step 1: Re-audit the inbox/poller path after the user correction that `Complete` must remain visible.
- [x] Step 2: Remove the active-set purge path that was incorrectly deleting tickets from the inbox.
- [x] Step 3: Keep terminal tickets in `listInbox()` and sync terminal Autotask status into the canonical inbox row.
- [x] Step 4: Update regression tests for poller + workflow core.
- [x] Step 5: Run backend verification and validate `T20260305.0037`.
- [x] Step 6: Document in wiki changelog.

## Progress Notes
- User correction is authoritative: the inbox is a mirror of the PSA, not an active-only queue.
- Root cause was twofold: `buildInboxListView()` hid terminal statuses locally, and `purgeMissingAutotaskTickets()` deleted rows when Autotask returned `Complete`.
- Fix direction: keep deletion only for real `not found`, and materialize terminal status via canonical sync event.
- Follow-up found immediately after deploy: terminal status convergence was still not fully automatic for all rows because parity purge only scanned the first `AUTOTASK_PARITY_PURGE_MAX_CHECKS` inbox tickets per run.
- Final fix: rotate the parity purge window round-robin per tenant so stale rows outside the top slice are revisited automatically without manual reconcile.
- Live re-check with `T20260305.0037` found another gap: if the ticket dropped out of the active queue snapshot before the round-robin purge reached it, the inbox could still stay stale for at least one extra cycle.
- Final-final fix: when queue snapshot covers a queue and an inbox row is missing from that active set, the poller now fetches that exact ticket and syncs terminal status immediately, or removes only if Autotask returns `not found`.

## Review
- Verification:
- `pnpm --filter @cerebro/api test -- autotask-polling.test.ts ticket-workflow-core.test.ts` ✅
- `pnpm --filter @cerebro/api typecheck` ✅
- `./scripts/stack.sh restart` ✅
- Live validation: one-off tenant-scoped reconcile of `T20260305.0037` updated inbox from `New` to `Complete` with `status_label=Complete` ✅
- Automatic convergence guard: regression proves a stale ticket outside the first purge window is revisited on the next automatic poll cycle and synced to `Complete` ✅
- Immediate convergence guard: regression proves a ticket missing from the active queue snapshot is reconciled in the same run and synced to `Complete` ✅
- Runtime validation after fresh restart: `T20260305.0037` now converges automatically to `Complete` without manual reconcile; `T20260305.0036` no longer resolves in Autotask and no longer has a live local status row; `T20260305.0038` remained `New` while the direct remote check hit Autotask `429` during validation ✅
- Documentation:
- `wiki/changelog/2026-03-05-workflow-inbox-terminal-status-mirror-fix.md`

# Task: Fix stack boot failure (web listener down)
**Status**: completed
**Started**: 2026-03-05T12:55:00-05:00

## Plan
- [x] Step 1: Check stack status and boot logs to identify failing service.
- [x] Step 2: Fix blocking build/lint errors in web app.
- [x] Step 3: Re-run web checks and restart stack.
- [x] Step 4: Verify api/web listener + health.
- [x] Step 5: Document in wiki changelog.

## Progress Notes
- Root cause was web build stop on ESLint `no-unused-vars` in `useSidebarState.ts`.
- Removed stale `API` import and stale `selectedGlobalQueueId` variable from sidebar state hook.
- Restarted full stack successfully with `api health: ok` and `web health: ok`.

## Review
- Verification:
- `pnpm --filter @cerebro/web typecheck` ✅
- `pnpm --filter @cerebro/web lint` ✅ (warnings only; no errors)
- `pnpm stack:restart` ✅
- `pnpm stack:status` ✅ (`api listener: running`, `web listener: running`, `api/web health: ok`)
- Documentation:
- `wiki/changelog/2026-03-05-web-stack-boot-fix-unused-sidebar-vars.md`

# Task: Recursive bug hunt across the repo
**Status**: completed
**Started**: 2026-03-06T11:35:00-05:00

## Plan
- [x] Step 1: Re-scan the repo and reproduce the next concrete bug instead of stopping after the first fix.
- [x] Step 2: Fix timer leakage in `autotask-polling.test.ts` and verify the focused suite.
- [x] Step 3: Reproduce and fix concurrent `.tmp` collisions in runtime JSON persistence helpers.
- [x] Step 4: Isolate the lingering Jest worker-exit warning to `ticket-workflow-core.test.ts` and remove the leaked timeout.
- [x] Step 5: Re-run focused tests, full API tests, and full monorepo checks.
- [x] Step 6: Document the round in the wiki.

## Progress Notes
- Bug 1: `autotask-polling.test.ts` still used real latency timers in “live-like” lookup tests. That left real timers alive long enough to contaminate worker shutdown.
- Fix 1: switched those latency cases to fake timers, advanced the clock through the full sequential lookup path, and cleared timers in `afterEach`.
- Bug 2: `writeJsonFileAtomic()` used a shared `${filePath}.tmp` name in two helper copies. Parallel writers could rename each other's temp file and trigger `ENOENT`.
- Fix 2: changed both helpers to use a unique temp filename per write and added a regression test that spawns concurrent `tsx` writers against the same file.
- Bug 3: `TicketWorkflowCoreService` used `Promise.race()` for inbox hydration without clearing the timeout when the remote snapshot returned first. That left pending timers and produced the recurring Jest worker-exit warning.
- Fix 3: clear the hydration timeout in `ticket-workflow-core.ts` and added a regression test that asserts no timers remain after a successful remote hydration.
- Final re-scan found no new reproducible test or typecheck failures. Monorepo test/typecheck/lint finished without errors, and the previous worker-exit warning disappeared.

## Review
- Verification:
- `pnpm --filter @cerebro/api test -- autotask-polling.test.ts` ✅
- `pnpm --filter @cerebro/api test -- --detectOpenHandles autotask-polling.test.ts` ✅
- `pnpm --filter @cerebro/api test -- runtime-json-file.test.ts` ✅
- `pnpm --filter @cerebro/api exec jest --silent src/__tests__/services/ticket-workflow-core.test.ts` ✅
- `pnpm --filter @cerebro/api exec jest --detectOpenHandles --silent src/__tests__/services/ticket-workflow-core.test.ts` ✅
- `pnpm --filter @cerebro/api exec jest --silent` ✅
- `pnpm -r test` ✅
- `pnpm -r typecheck` ✅
- `pnpm -r lint` ✅ (warnings only; no errors)
- Documentation:
- `wiki/changelog/2026-03-06-recursive-bug-hunt-worker-exit-and-runtime-json-races.md`

# Task: Repo-wide lint warning cleanup
**Status**: completed
**Started**: 2026-03-06T15:10:00-05:00

## Plan
- [x] Step 1: Measure current lint warnings by rule and file.
- [x] Step 2: Apply safe mechanical fixes first across web/api.
- [x] Step 3: Re-run lint/typecheck and keep reducing the next obvious clusters.
- [x] Step 4: Finish the remaining heavy warning clusters in the context pipeline and old tests.
- [x] Step 5: Document this cleanup round in the wiki.

## Progress Notes
- Cleared the remaining warnings in `apps/web`, including the triage home page.
- Cleaned recently touched API files such as `auth-route-handlers.ts`, `seed-admin.ts`, `platform-admin-route-handlers.ts`, and `tenant-slug.ts`.
- Converted the legacy `apps/api/src/services/prepare-context.ts` into a thin compatibility facade over `services/context/*`, removing a large block of duplicated warnings without changing public imports.
- Removed repeated `no-useless-escape`, `consistent-type-imports`, and dead-import/dead-constant warnings in context and adapter helpers.
- Continued the sweep through the remaining heavy API hotspots and route handlers: `prepare-context.ts`, `playbook-route-handlers.ts`, `autotask-route-handlers.ts`, `ticket-intake-route-handlers.ts`, and `workflow-route-handlers.ts`.
- Replaced broad `any` casts with explicit record narrowing in route handlers, integration overlays, sidebar hydration, and workflow command/sync payload shaping.
- Finished the long tail in tests, helper scripts, middleware, and read-only services, including `diagnose-calibration.test.ts`, `playbook-writer-structure.test.ts`, `observability-correlation.test.ts`, `check-ticket-payload.ts`, and `tenant.ts`.
- Final result for this cleanup track: `apps/api` lint warnings went from `1251` to `0`, and the monorepo now finishes lint and typecheck without warnings or errors on the touched surfaces.

## Review
- Verification:
- `pnpm --filter @cerebro/api test -- src/__tests__/services/prepare-context-persistence-bridge.test.ts src/__tests__/services/prepare-context.test.ts src/__tests__/services/prepare-context-device-resolution.test.ts` ✅
- `pnpm --filter @cerebro/api typecheck` ✅
- `pnpm --filter @cerebro/api lint` ✅ (`0` warnings, `0` errors)
- `pnpm --filter @cerebro/api test -- src/__tests__/routes/playbook.full-flow-stale-ticket.test.ts src/__tests__/routes/autotask.ticket-ssot-merge.test.ts src/__tests__/routes/triage.integration.test.ts src/__tests__/routes/workflow.reconcile-route.test.ts src/__tests__/services/prepare-context.test.ts src/__tests__/services/playbook-writer-structure.test.ts src/__tests__/services/diagnose-calibration.test.ts src/__tests__/services/diagnose-fail-fast.test.ts src/__tests__/platform/observability-correlation.test.ts` ✅
- `pnpm --filter @cerebro/api test -- src/__tests__/services/p0-manager-ops-visibility.test.ts src/__tests__/routes/auth.workspace-settings.test.ts src/__tests__/routes/identity-transaction-boundaries.test.ts` ✅
- `pnpm -r typecheck` ✅
- `pnpm -r lint` ✅
- Documentation:
- `wiki/changelog/2026-03-06-lint-warning-reduction-round-1.md`
- `wiki/changelog/2026-03-06-lint-warning-reduction-round-5-api-warning-zero.md`
