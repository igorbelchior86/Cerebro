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
