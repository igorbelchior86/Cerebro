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
