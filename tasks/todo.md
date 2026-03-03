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
