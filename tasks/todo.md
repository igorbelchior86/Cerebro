# Task: Exibir e editar status real do ticket na sidebar
**Status**: completed
**Started**: 2026-03-01T12:02:00-05:00

## Plan
- [x] Step 1: Mapear a sidebar, o card do draft e as superfícies já existentes de status no Autotask.
- [x] Step 2: Expor o catálogo de `status` do Autotask e preservar o status real do ticket nos dados da sidebar.
- [x] Step 3: Renderizar a pílula de status com pencil na sidebar para tickets reais e para o draft de `New Ticket`, com status default `New` no draft.
- [x] Step 4: Ligar a edição do status ao draft local e ao update real no Autotask para tickets existentes.
- [x] Step 5: Validar com typecheck web+api e documentar a mudança na wiki local.

## Open Questions
- Assumindo o menor impacto: o badge atual no topo do card continua representando o estado operacional/workflow da sidebar; a nova pílula passa a representar o status real do ticket no Autotask.

## Progress Notes
- Hoje a sidebar já tem um badge no topo, mas ele representa o status operacional interno e ocupa outro slot visual.
- O espaço vazio abaixo do timestamp é o melhor ponto para a nova pílula de status do ticket.

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
  - `pnpm --filter @playbook-brain/api typecheck` ⚠️ bloqueado por erros preexistentes e não relacionados em `apps/api/src/services/prepare-context.ts` (`iterativeEnrichment` fora de escopo)
- Documentação criada:
  - `wiki/features/2026-03-01-sidebar-ticket-status-pill-and-draft-status-editor.md`

---

# Task: Corrigir falso erro enquanto create do draft ainda está processando
**Status**: completed
**Started**: 2026-03-01T11:46:00-05:00

## Plan
- [x] Step 1: Confirmar que o botão verde está desistindo cedo demais do polling do comando de create.
- [x] Step 2: Aumentar a janela de polling e tratar `accepted/processing` como estado pendente normal.
- [x] Step 3: Validar com typecheck do frontend.
- [x] Step 4: Documentar a mudança na wiki local.

## Open Questions
- Sem perguntas abertas; a correção é local ao polling do create no frontend.

## Progress Notes
- O create usa `workflow/commands` com `202 accepted`, então a UI precisa acompanhar o job assíncrono por mais tempo antes de falhar.

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
- Documentação criada:
  - `wiki/features/2026-03-01-new-ticket-create-polling-window-fix.md`

---

# Task: Permitir create com org 0 no new ticket
**Status**: completed
**Started**: 2026-03-01T11:40:00-05:00

## Plan
- [x] Step 1: Confirmar que a validação do botão verde trata `org 0` como falsy.
- [x] Step 2: Ajustar a checagem para aceitar `0` como company id válido.
- [x] Step 3: Validar com typecheck do frontend.
- [x] Step 4: Documentar a mudança na wiki local.

## Open Questions
- Sem perguntas abertas; a correção é local à validação do draft.

## Progress Notes
- O erro mostrado é coerente com `if (!companyId)` em `acceptDraft`, que rejeita `0`.

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
- Documentação criada:
  - `wiki/features/2026-03-01-new-ticket-org-zero-validation-fix.md`

---

# Task: Corrigir race de busca no draft e ligar create real ao botão verde
**Status**: completed
**Started**: 2026-03-01T11:32:00-05:00

## Plan
- [x] Step 1: Confirmar a causa do 429 no modal de busca do `New Ticket` e localizar o write-path existente para criação de ticket.
- [x] Step 2: Debounce/cancelar a busca remota inicial do draft para evitar concorrência com a digitação.
- [x] Step 3: Ligar o botão verde ao pipeline auditado de `workflow/commands` para criar o ticket de fato no Autotask.
- [x] Step 4: Validar com typecheck web+api e documentar a mudança na wiki local.

## Open Questions
- Assumindo o menor risco: a criação real do ticket deve reutilizar o pipeline de workflow já auditado (`command_type: create`), sem criar endpoint novo de write fora da camada existente.

## Progress Notes
- O 429 em `Edit Org` vem de concorrência entre o fetch vazio inicial e a busca digitada no mesmo modal.
- O backend já possui `tickets.create` via `workflow/commands`, então o check verde pode reutilizar essa superfície auditada.

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
  - `pnpm --filter @playbook-brain/api typecheck` ✅
- Documentação criada:
  - `wiki/features/2026-03-01-new-ticket-search-debounce-and-create-action.md`

---

# Task: Adicionar ações de aceitar/rejeitar no header do new ticket
**Status**: completed
**Started**: 2026-03-01T11:22:00-05:00

## Plan
- [x] Step 1: Localizar a row de `Primary` / `Secondary` em `triage/home`.
- [x] Step 2: Adicionar botões redondos de check e X no lado direito da mesma row, preservando o layout atual.
- [x] Step 3: Validar com typecheck do frontend.
- [x] Step 4: Documentar a mudança na wiki local.

## Open Questions
- Assumindo escopo estritamente de UI: `X` descarta o draft local; o check permanece como aceite local do draft, sem criar ticket no Autotask nesta etapa.

## Progress Notes
- O fluxo `New Ticket` ainda não possui create backend, então esta mudança fica restrita à shell do draft.

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
- Documentação criada:
  - `wiki/features/2026-03-01-new-ticket-draft-decision-buttons.md`

---

# Task: Pesquisar defaults do Autotask em novo ticket
**Status**: completed
**Started**: 2026-03-01T11:14:00-05:00

## Plan
- [x] Step 1: Revisar rapidamente como o draft de `New Ticket` inicializa `Priority` e `SLA` hoje.
- [x] Step 2: Pesquisar documentação oficial do Autotask/Kaseya sobre campos pré-populados em novos tickets.
- [x] Step 3: Consolidar o porquê técnico desses defaults e o impacto para a nossa skin.
- [x] Step 4: Registrar a investigação no Review.

## Open Questions
- Sem alteração de código nesta etapa; objetivo é entendimento do comportamento fonte antes de decidir implementação.

## Progress Notes
- O draft local atual só popula esses campos após seleção manual; não existe default equivalente ao Autotask ainda.

## Review
- Evidência oficial encontrada:
  - `Tickets` REST entity: se `ticketCategory` não é enviado, o Autotask usa a categoria default do resource logado; se não houver, usa a categoria default da empresa. Os default values da categoria são aplicados, a menos que outro valor seja enviado.
  - `Tickets` REST entity: `serviceLevelAgreementID` é defaultado por cadeia de precedência: Asset SLA -> Contract Service/Bundle SLA -> Contract SLA -> Ticket Category SLA.
  - `TicketCategories` possui child collection `TicketCategoryFieldDefaults`.
  - `TicketCategoryFieldDefaults` lista explicitamente `priority`, `issueTypeID`, `subIssueTypeID`, `serviceLevelAgreementID`, `queueID`, `status`, `sourceID` etc. como defaults da categoria.
- Conclusão:
  - O Autotask pré-popula `Priority`, `Issue/Sub-Issue` e, em muitos cenários, `SLA` porque o `New Ticket` nasce já sob uma `ticketCategory` efetiva e essa categoria tem defaults próprios; no caso do `SLA`, ainda existe uma lógica adicional de herança por asset/contrato antes de cair para a categoria.
  - Nossa skin hoje não replica isso porque o draft local começa vazio e só preenche esses campos por escolha manual.

---

# Task: Alinhar direção da animação do toggle secundário de contexto
**Status**: completed
**Started**: 2026-03-01T11:08:00-05:00

## Plan
- [x] Step 1: Inspecionar a diferença de comportamento entre o toggle de `Context` e o toggle secundário do card.
- [x] Step 2: Ajustar o `CollapseToggleButton` para suportar direção semântica consistente com a área expandida.
- [x] Step 3: Validar com typecheck do frontend.
- [x] Step 4: Documentar a mudança na wiki local.

## Open Questions
- Assumindo a menor mudança correta: manter a mesma animação-base e mudar apenas a direção semântica do toggle inferior, porque ele expande conteúdo para cima.

## Progress Notes
- O toggle principal expande para baixo; o toggle secundário fica ancorado no canto inferior direito e expande conteúdo acima dele.

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
- Documentação criada:
  - `wiki/features/2026-03-01-context-secondary-toggle-direction-fix.md`

---

# Task: Reordenar campos opcionais no card de contexto
**Status**: completed
**Started**: 2026-03-01T11:02:00-05:00

## Plan
- [x] Step 1: Localizar a ordem atual dos quatro campos opcionais em `triage/home` e `triage/[id]`.
- [x] Step 2: Reordenar para `Issue Type`, `Sub-Issue Type`, `Priority`, `Service Level Agreement`.
- [x] Step 3: Validar com typecheck do frontend.
- [x] Step 4: Documentar a mudança na wiki local.

## Open Questions
- Sem perguntas abertas; a mudança é apenas de ordem visual.

## Progress Notes
- A ordem atual está consistente entre os dois fluxos, mas começa com `Priority`.

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
- Documentação criada:
  - `wiki/features/2026-03-01-context-optional-field-order-adjustment.md`

---

# Task: Corrigir labels históricos ausentes nos campos opcionais do contexto
**Status**: completed
**Started**: 2026-03-01T10:48:00-05:00

## Plan
- [x] Step 1: Inspecionar o payload real do ticket afetado e confirmar por que os labels continuam ausentes.
- [x] Step 2: Corrigir a fonte autoritativa para tickets antigos que ainda só têm IDs.
- [x] Step 3: Garantir que a UI derive labels corretamente sem duplicar estado.
- [x] Step 4: Validar com typecheck web+api e documentar a correção na wiki local.

## Open Questions
- Assumindo a menor mudança segura: se o SSOT não tiver labels para tickets antigos, a UI pode resolvê-los localmente a partir dos catálogos já cacheáveis, sem introduzir novo write automático no provider.

## Progress Notes
- A correção anterior cobre tickets cujo SSOT já possui labels persistidos.
- O ticket `T20260226.0033` indica um caso histórico em que o payload ainda chega apenas com IDs, então preciso tratar o cenário de ausência de label no runtime atual.

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
  - `pnpm --filter @playbook-brain/api typecheck` ✅
- Documentação criada:
  - `wiki/features/2026-03-01-context-historical-picklist-label-derivation-fix.md`

---

# Task: Corrigir labels dos campos opcionais no card de contexto
**Status**: completed
**Started**: 2026-03-01T10:40:00-05:00

## Plan
- [x] Step 1: Confirmar por que `triage/[id]` renderiza IDs numéricos em vez de labels.
- [x] Step 2: Projetar os labels já persistidos no read-model de `playbook/full-flow`.
- [x] Step 3: Ajustar o render da UI para priorizar os labels autoritativos.
- [x] Step 4: Validar com typecheck web+api e documentar a correção na wiki local.

## Open Questions
- Assumindo a correção mínima: usar os labels já persistidos em `ticket_ssot.autotask_authoritative`, sem adicionar novas leituras de picklist no polling de `full-flow`.

## Progress Notes
- O write-path já devolve e persiste `priorityLabel`, `issueTypeLabel`, `subIssueTypeLabel` e `serviceLevelAgreementLabel`.
- O bug está no read-path principal: `playbook/full-flow` expõe os IDs no objeto `ticket`, e `triage/[id]` usa esses IDs como fallback visual.

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
  - `pnpm --filter @playbook-brain/api typecheck` ✅
- Documentação criada:
  - `wiki/features/2026-03-01-context-ticket-picklist-label-render-fix.md`

---

# Task: Remover 429 dos editores opcionais de metadata do ticket
**Status**: completed
**Started**: 2026-03-01T10:28:00-05:00

## Plan
- [x] Step 1: Confirmar no código por que os 4 editores estão repetindo o mesmo 429 do Autotask.
- [x] Step 2: Reduzir a superfície backend para buscar apenas o picklist solicitado e sem paralelismo desnecessário.
- [x] Step 3: Fazer cache local dos catálogos no frontend e filtrar pelo texto digitado sem novo fetch a cada tecla.
- [x] Step 4: Validar com typecheck web+api e documentar a correção na wiki local.

## Open Questions
- Assumindo que os catálogos podem ser tratados como quasi-estáticos durante a sessão do modal; não haverá refresh forçado por digitação.

## Progress Notes
- A regressão é estrutural: os editores opcionais usavam metadata remota como se fosse autocomplete remoto, quando na prática são picklists.
- O erro 429 é consistente com excesso de leituras simultâneas/repetidas no Autotask, não com falha específica de um campo.

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
  - `pnpm --filter @playbook-brain/api typecheck` ✅
- Documentação criada:
  - `wiki/features/2026-03-01-ticket-field-editor-429-rate-limit-fix.md`

---

# Task: Expandir card de contexto com metadados opcionais de ticket
**Status**: completed
**Started**: 2026-03-01T10:05:00-05:00

## Plan
- [x] Step 1: Mapear a animação atual de expand/collapse e verificar se já existe superfície Autotask para `Priority`, `Issue Type`, `Sub-Issue Type` e `Service Level Agreement`.
- [x] Step 2: Adicionar o botão secundário no primeiro card da seção `Context` e expandir os 4 campos com a mesma linguagem de animação.
- [x] Step 3: Expor catálogo de dropdowns no backend/frontend e ligar os novos campos ao mesmo fluxo de edição em `triage/home` e `triage/[id]`.
- [x] Step 4: Validar com typecheck do frontend e da API e documentar na wiki local.

## Open Questions
- Assumindo o menor impacto: os novos campos reutilizam o modal de edição existente, sem criar uma UI nova de dropdown inline.

## Progress Notes
- `PlaybookPanel` já usa `gridTemplateRows + opacity + translateY` para expand/collapse, então vou reaproveitar exatamente esse padrão no subbloco do card de identidade.
- O client Autotask já tem leitura genérica de picklists (`getTicketFieldPicklist`), então a implementação pode expor só uma superfície fina para esses quatro catálogos.
- O primeiro card da seção `Context` agora tem um segundo toggle no canto inferior direito que revela `Priority`, `Issue Type`, `Sub-Issue Type` e `Service Level Agreement` dentro do mesmo card.
- O mesmo modal de edição foi reaproveitado para esses campos, com catálogo vindo de `ticket-field-options`; em `triage/[id]` a seleção faz write-through para Autotask e em `triage/home` a seleção fica no draft local.

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
  - `pnpm --filter @playbook-brain/api typecheck` ✅
- Documentação criada:
  - `wiki/features/2026-03-01-context-optional-ticket-metadata-expansion.md`

---

# Task: Recolocar New Ticket na shell canônica com wiring local de draft
**Status**: completed
**Started**: 2026-03-01T09:20:00-05:00

## Plan
- [x] Step 1: Confirmar onde `triage/home` diverge da shell canônica e quais campos já existem no layout atual.
- [x] Step 2: Substituir o formulário alternativo por um draft local no mesmo layout do ticket (header, pills, feed, chat bar e painel direito).
- [x] Step 3: Ligar os campos do draft ao wiring correto: `title`, body via `ChatInput`, `Primary`/`Secondary`, `Org`/`Contact`/`Additional contacts`, com fila implícita em `Triage`.
- [x] Step 4: Validar com typecheck do frontend e documentar a mudança na wiki local.

## Open Questions
- Assumindo que esta etapa é somente frontend/local draft: ainda não haverá persistência nem criação efetiva do ticket no backend.

## Progress Notes
- `triage/home` estava usando um formulário customizado que quebra a paridade visual e operacional com `triage/[id]`.
- O ajuste será local ao frontend, preservando a rota em `Triage` até existir UI explícita de queue.
- `triage/home` agora reutiliza a shell canônica: header com `title`, pills de tech, feed central para preview do body e `ChatInput` como compositor.
- O painel direito voltou a ser o ponto de assignment do cliente (`Org`, `Contact`, `Additional contacts`) e usa busca Autotask local para preencher o draft.

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
- Documentação criada:
  - `wiki/features/2026-03-01-new-ticket-canonical-draft-wiring.md`

---

# Task: Corrigir New Ticket para espelhar o workspace real do Autotask
**Status**: completed
**Started**: 2026-02-28T11:34:00-05:00

## Plan
- [x] Step 1: Confirmar o comportamento real do “New Ticket” no Autotask e mapear o desvio da implementação atual.
- [x] Step 2: Reusar a mesma interface do workspace de ticket em andamento, colocando a tela em modo draft com campos vazios/populáveis.
- [x] Step 3: Remover a tela simplificada incorreta e ligar o botão `New Ticket` ao workspace correto.
- [x] Step 4: Validar o frontend e atualizar a wiki obrigatória com a correção.

## Open Questions
- Assumindo que o fluxo correto é “mesma shell do ticket”, sem criar a sessão imediatamente; a criação efetiva continua quando o usuário preencher/salvar.

## Progress Notes
- O usuário corrigiu explicitamente o requisito: `New Ticket` no Autotask mantém a mesma interface do ticket, em estado vazio.
- Pesquisa externa e screenshot do usuário serão usados como fonte de confirmação antes da refatoração.
- Context7 foi chamado por obrigação contratual, mas segue indisponível por limite de quota.
- A tela `/triage/home` foi reescrita para manter a mesma shell tri-pane do ticket em andamento, agora em modo draft local.
- O draft central agora expõe campos vazios (`Account`, `Contact`, `Status`, `Priority`, `Title`, `Description`, `Issue Type`, `Sub-Issue Type`) em vez de uma tela separada de intake.
- O painel direito voltou a usar `PlaybookPanel`, refletindo contexto vazio do draft em vez de um card alternativo.

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
- Documentação criada:
  - `wiki/features/2026-02-28-new-ticket-workspace-parity-with-autotask.md`

---

# Task: Sidebar com botão New Ticket e estado tri-pane de criação Autotask
**Status**: completed
**Started**: 2026-02-28T11:20:00-05:00

## Plan
- [x] Step 1: Ajustar `ChatSidebar` para manter apenas o card de `Active` e substituir `Done today`/`Avg time` por um único botão `New Ticket`.
- [x] Step 2: Reaproveitar o fluxo atual de criação de sessão Autotask em `triage/home`, convertendo a tela para um estado tri-pane com colunas central/direita vazias e prontas para preenchimento.
- [x] Step 3: Conectar a navegação do botão na sidebar para abrir esse estado de criação a partir das telas de triage.
- [x] Step 4: Validar com typecheck do frontend e registrar a mudança na wiki local.

## Open Questions
- Assumindo que o fluxo de “new ticket” deve permanecer no frontend e continuar usando `POST /triage/sessions` (sem mudança de backend).

## Progress Notes
- Context7 MCP foi invocado por exigência do contrato, mas a cota disponível retornou erro de quota; seguirei com leitura do código local como fonte primária.
- `ChatSidebar` agora mantém apenas `Active` e um CTA único `New Ticket`.
- `/triage/home` foi convertido para draft tri-pane de criação de sessão com lógica Autotask existente (`POST /triage/sessions`).
- `triage/[id]` agora usa o mesmo CTA para retornar ao estado vazio de criação.

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
- Documentação criada:
  - `wiki/features/2026-02-28-sidebar-new-ticket-autotask-draft.md`

---

# Task: Nota ainda ausente por processo local da API desatualizado
**Status**: completed
**Started**: 2026-02-27T21:34:00-03:00

## Plan
- [x] Step 1: Verificar se o backend em `:3001` estava servindo o código novo.
- [x] Step 2: Confirmar modo de execução da API local.
- [x] Step 3: Reiniciar a API em watch mode com o código atualizado.

## Open Questions
- Sem bloqueios técnicos.

## Progress Notes
- O processo da API em `localhost:3001` estava rodando uma instância antiga e sem watch, então não recarregou as mudanças recentes.
- A UI no browser estava falando com esse processo stale, por isso a nota continuava faltando mesmo com o patch já no código.
- API reiniciada com `pnpm dev` (`nodemon -w src`) e servidor confirmado em `http://localhost:3001`.

## Review
- Verificação executada:
  - startup confirmado: `[API] ✓ Server running at http://localhost:3001`

---
# Task: Nota ausente resolvida via server-side notes no full-flow
**Status**: completed
**Started**: 2026-02-27T21:18:00-03:00

## Plan
- [x] Step 1: Eliminar dependência de fetch best-effort de notas no browser.
- [x] Step 2: Incluir notas do Autotask no payload de `/playbook/full-flow`.
- [x] Step 3: Adaptar frontend para consumir `data.ticket_notes` do backend.
- [x] Step 4: Validar typecheck web+api e atualizar documentação obrigatória.

## Open Questions
- Sem bloqueios técnicos.

## Progress Notes
- A explicação anterior focada em ordenação era insuficiente para o bug reportado.
- Solução estrutural aplicada: `playbook/full-flow` agora busca `ticket notes` no backend e devolve `data.ticket_notes`.
- Frontend deixou de depender de um request adicional silencioso no browser para montar o feed de notas.
- Isso remove uma classe inteira de falhas de sessão/CORS/erro engolido e alinha melhor com a meta de “skin do Autotask”.

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
  - `pnpm --filter @playbook-brain/api typecheck` ✅
- Documentação criada:
  - `wiki/features/2026-02-27-playbook-full-flow-server-side-ticket-notes.md`

---
# Task: Nota de 2:22 PM ausente por campo de timestamp Autotask
**Status**: completed
**Started**: 2026-02-27T21:05:00-03:00

## Plan
- [x] Step 1: Inspecionar payload real do `getTicketNotes(132810)`.
- [x] Step 2: Corrigir parser do frontend para o shape real do Autotask.
- [x] Step 3: Endurecer filtro de workflow rule pelo `noteType`.
- [x] Step 4: Validar typecheck web e atualizar documentação obrigatória.

## Open Questions
- Sem bloqueios técnicos; o payload real confirmou o shape esperado.

## Progress Notes
- Reproduzido com script local contra o client do projeto: a nota `Service Desk Notification` existe em Autotask (`id=30753243`).
- Root cause confirmado: o payload usa `createDateTime`, mas o frontend estava lendo `createDate`.
- Isso distorcia a ordenação temporal e dificultava localizar a nota correta no feed.
- Filtro de workflow rule endurecido para `noteType = 13`, além do texto.

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
- Documentação criada:
  - `wiki/features/2026-02-27-autotask-note-createdatetime-parser-fix.md`

---
# Task: Paridade semi-total de comunicação PSA (excluir workflow rules)
**Status**: completed
**Started**: 2026-02-27T20:42:00-03:00

## Plan
- [x] Step 1: Definir recorte de paridade: incluir stream de notas PSA e excluir `Workflow Rule`.
- [x] Step 2: Filtrar notas de workflow rule no mapeamento do feed.
- [x] Step 3: Enriquecer composição de nota para preservar título + corpo quando ambos existirem.
- [x] Step 4: Validar typecheck web e atualizar documentação obrigatória.

## Open Questions
- Sem bloqueios técnicos; recorte atual permanece no stream de ticket notes (não inclui time entries).

## Progress Notes
- Filtro adicionado no stream de notas do Autotask com regra explícita por conteúdo (`workflow rule`).
- Composição de notas PSA ficou mais fiel: quando há `title/subject` e `body/noteText`, o feed renderiza ambos em vez de descartar um dos campos.
- Isso preserva a maior parte da comunicação do PSA dentro do feed e elimina o ruído operacional de regras automáticas.

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
- Documentação criada:
  - `wiki/features/2026-02-27-psa-semi-total-parity-excluding-workflow-rules.md`

---
# Task: Paridade de notas PSA no Cerebro (lookup robusto + tenant-scoped)
**Status**: completed
**Started**: 2026-02-27T20:28:00-03:00

## Plan
- [x] Step 1: Confirmar por que a nota do PSA ainda não aparecia após fix anterior.
- [x] Step 2: Corrigir endpoint de notas para usar client tenant-scoped e aceitar ticket number além de ID numérico.
- [x] Step 3: Corrigir frontend para resolver referência de lookup com fallback (`numeric id`, `external_id`, `ticket number`).
- [x] Step 4: Validar typecheck web+api e atualizar documentação obrigatória.

## Open Questions
- Sem bloqueios técnicos.

## Progress Notes
- Identificado gap: endpoint `/autotask/ticket/:id/notes` usava `getClient()` (env) + `parseInt`, o que podia falhar para `T2026...` e/ou tenant incorreto.
- Endpoint ajustado para:
  - usar `getTenantScopedClient()`;
  - resolver ticket por `ticketNumber` quando parâmetro não numérico;
  - retornar `ticket_lookup` com referência solicitada e ID resolvido.
- Frontend ajustado para lookup de notas com fallback encadeado:
  - `ticket.autotask_ticket_id_numeric`;
  - `ssot.autotask_authoritative.ticket_id_numeric`;
  - `workflow inbox external_id`;
  - `ticket.id`;
  - `resolved ticketId/sessionId`.
- Mantida deduplicação + ordenação cronológica no feed.

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
  - `pnpm --filter @playbook-brain/api typecheck` ✅
- Documentação criada:
  - `wiki/features/2026-02-27-psa-note-parity-tenant-scoped-lookup-fallback.md`

---
# Task: Nota específica do Autotask (Service Desk Notification) não aparece no feed
**Status**: completed
**Started**: 2026-02-27T20:10:00-03:00

## Plan
- [x] Step 1: Reproduzir causa raiz no fluxo atual (Autotask -> workflow inbox -> timeline).
- [x] Step 2: Corrigir projeção para incluir notas do endpoint Autotask por ticket numérico.
- [x] Step 3: Deduplicar notas entre `workflow inbox comments` e `autotask notes`.
- [x] Step 4: Validar typecheck e atualizar documentação obrigatória.

## Open Questions
- Sem bloqueios técnicos.

## Progress Notes
- Causa raiz confirmada: `workflow inbox comments` só refletia notas de comandos locais/sync com payload de comentário; notas externas como “Service Desk Notification” não eram ingeridas pelo poller padrão.
- Implementado fetch best-effort de `/autotask/ticket/:id/notes` usando `ticket.autotask_ticket_id_numeric`/SSOT.
- Notas do Autotask agora entram como `type: note` no feed com mapeamento de visibilidade (`publish=1` público, demais interno).
- Deduplicação aplicada para evitar duplicatas quando nota já existe em `workflow inbox comments`.

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
- Documentação criada:
  - `wiki/features/2026-02-27-autotask-service-desk-notification-note-feed-fix.md`

---
# Task: Notas internas/externas do Autotask não aparecem no Cerebro (T20260226.0033)
**Status**: completed
**Started**: 2026-02-27T19:48:00-03:00

## Plan
- [x] Step 1: Reproduzir com ticket `T20260226.0033` e identificar camada de perda (Autotask/API/UI).
- [x] Step 2: Corrigir ingestão/projeção/renderização das notas mantendo separação internal/public.
- [x] Step 3: Validar com evidência (endpoint + UI model) e checks de tipo/testes relevantes.
- [x] Step 4: Atualizar `tasks/todo.md`, `tasks/lessons.md` e wiki.

## Open Questions
- Sem bloqueios técnicos após diagnóstico.

## Progress Notes
- Iniciado diagnóstico orientado por ticket real informado pelo usuário.
- Confirmado: `/playbook/full-flow` não devolve notas no payload da timeline, mas `workflow inbox` já expõe `comments` (`internal`/`public`).
- `triage/[id]/page.tsx` passou a projetar `workflowTicket.comments` no feed central como mensagens `type: 'note'`.
- Mapeamento aplicado: `visibility=internal -> channel=internal_ai`; `visibility=public -> channel=external_psa_user`.
- Timeline agora ordena por `timestamp` após injeção de notas para manter cronologia estável.
- `ChatMessage` atualizado para suportar `type: 'note'` com label contextual (`Internal Note` / `PSA/User Note`).

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
- Documentação criada:
  - `wiki/features/2026-02-27-autotask-internal-external-notes-visible-in-middle-feed.md`

---
# Task: Colorização de balões por categoria de mensagem
**Status**: completed
**Started**: 2026-02-27T19:39:00-03:00

## Plan
- [x] Step 1: Mapear categorias reais de mensagens no `ChatMessage` (role + channel + type).
- [x] Step 2: Definir paleta harmônica por categoria usando variações no círculo cromático da paleta atual.
- [x] Step 3: Aplicar backgrounds/borders por categoria mantendo legibilidade.
- [x] Step 4: Verificar categorias faltantes e cobrir mensagens `system/status`.
- [x] Step 5: Validar typecheck web e documentar wiki/lessons.

## Open Questions
- Sem bloqueios técnicos; a cobertura incluirá categorias extras necessárias além das citadas (system/status e estágios de pipeline).

## Progress Notes
- Mapeamento inicial concluído: categorias efetivas derivam de `role`, `channel` e `type`.
- Categoria resolver implementado: `resolveBubbleCategory(message)`.
- Tabela harmônica aplicada: `BUBBLE_TONES` com tons para `ai`, `note`, `tech_to_ai`, `tech_to_user`, `ai_exchange`, `ai_validation`, `system_status`.

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
- Documentação criada:
  - `wiki/features/2026-02-27-chatmessage-category-color-palette.md`

---

# Task: Aumentar respiro abaixo da linha de metadata do balão
**Update**: 2026-02-27T19:29:00-03:00
- [x] Incremento adicional de padding conforme feedback do usuário.

**Status**: completed
**Started**: 2026-02-27T19:24:00-03:00

## Plan
- [x] Step 1: Identificar container de metadata do balão em `ChatMessage`.
- [x] Step 2: Aumentar spacing vertical após metadata para separar melhor mensagens.
- [x] Step 3: Aplicar o mesmo respiro para mensagens user/pipeline.
- [x] Step 4: Validar typecheck web e documentar wiki/lessons.

## Open Questions
- Sem bloqueios técnicos.

## Progress Notes
- `marginBottom` do bloco de mensagem passou de `10px` para `16px`.
- `marginTop` da linha de metadata passou de `6px` para `8px`.

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
- Documentação criada:
  - `wiki/features/2026-02-27-chatmessage-increase-meta-bottom-breathing-space.md`

---
# Task: Placeholder dinâmico conforme pill de destino
**Status**: completed
**Started**: 2026-02-27T19:12:00-03:00

## Plan
- [x] Step 1: Identificar ponto de render do placeholder no `ChatInput`.
- [x] Step 2: Derivar placeholder por `targetChannel` (`AI` vs `User`).
- [x] Step 3: Preservar placeholder de processing quando `disabled`.
- [x] Step 4: Validar typecheck web e documentar wiki/lessons.

## Open Questions
- Sem bloqueios técnicos.

## Progress Notes
- Placeholder agora muda conforme estado da pill.
- Contrato de submit e toggle permaneceram inalterados.

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
- Documentação criada:
  - `wiki/features/2026-02-27-chatinput-dynamic-placeholder-by-pill-channel.md`

---
# Task: Destination toggle como pílula única dentro do campo (esquerda)
**Update**: 2026-02-27T19:05:00-03:00
- [x] Ajuste de pílula para tamanho fixo (somente texto/cor variam).


**Status**: completed
**Started**: 2026-02-27T18:55:00-03:00

## Plan
- [x] Step 1: Remover bloco de destino separado acima do composer.
- [x] Step 2: Inserir pílula única dentro do campo à esquerda.
- [x] Step 3: Alternar no clique `AI` ↔ `User` mantendo `targetChannel` existente.
- [x] Step 4: Preservar hints/tabs e comportamento atual de submit/attachments.
- [x] Step 5: Validar typecheck web e documentar wiki/lessons.

## Open Questions
- Sem bloqueios técnicos.

## Progress Notes
- Implementação concentrada em `ChatInput`.
- A pílula única renderiza label dinâmica (`AI` quando `internal_ai`, `User` quando `external_psa_user`).
- Clique alterna canal sem alterar contrato do payload (`targetChannel`).

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
- Documentação criada:
  - `wiki/features/2026-02-27-chatinput-destination-single-pill-inside-field.md`
- Lessons atualizadas após correção de UX do usuário.

---

# Task: UX hardening da coluna central (canal AI/PSA mais limpo e legível)
**Status**: completed
**Started**: 2026-02-27T18:42:00-03:00

## Plan
- [x] Step 1: Reduzir ruído visual dos balões (remover badge flutuante e padronizar metadata de canal).
- [x] Step 2: Melhorar feedback de entrega externa com chips semânticos (`sending/sent/failed/retrying`) e erro legível.
- [x] Step 3: Refinar hierarquia do composer (Destination segmentado + hints menos agressivos quando toggle ativo).
- [x] Step 4: Melhorar filtro de canal para connected group com contagem por canal.
- [x] Step 5: Validar typecheck web e documentar wiki/lessons.

## Open Questions
- Sem bloqueios técnicos.

## Progress Notes
- `ChatMessage`:
  - badge de canal saiu de overlay dentro do balão e foi para linha de metadata.
  - estado de entrega virou chip visual semântico e com contraste melhor.
  - balões externos ganharam acento lateral sutil (evita “mancha” de fundo forte).
- `ChatInput`:
  - linha de destino reestruturada com hierarquia melhor.
  - hints em modo toggle ativo passaram para pills discretas.
- `triage/[id]`:
  - filtro de canal virou grupo segmentado conectado com contagem (`All`, `AI`, `PSA/User`).
- Contrato funcional preservado (sem mudança de fluxo interno/externo).

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
- Documentação criada:
  - `wiki/features/2026-02-27-middle-column-channel-ux-hardening.md`
- Lessons atualizadas com correção de feedback visual do usuário.

---

# Task: Coluna central com feed único + alternância AI vs PSA/User
**Status**: completed
**Started**: 2026-02-27T18:20:00-03:00

## Plan
- [x] Step 1: Expandir contrato de mensagens/composer com `channel` e `targetChannel`.
- [x] Step 2: Implementar diferenciação visual por canal (badge + borda/fundo) em `ChatMessage`.
- [x] Step 3: Integrar envio externo PSA/User via workflow command com estado de entrega (`sending/sent/failed/retrying`) e retry.
- [x] Step 4: Adicionar filtro rápido (`All/AI/PSA-User`) no feed da coluna central.
- [x] Step 5: Persistir canal selecionado por ticket (default AI) e emitir telemetria frontend solicitada.
- [x] Step 6: Validar typecheck/lint web e documentar wiki.

## Open Questions
- Sem bloqueios técnicos no escopo atual.

## Progress Notes
- Implementação aplicada em `ChatInput`, `ChatMessage`, `triage/[id]/page.tsx` e `triage/home/page.tsx`.
- Fluxo externo usa `submitWorkflowCommand(create_comment_note)` com `comment_visibility=public`.
- Retry externo implementado diretamente no balão em estado `failed`.

## Review
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
  - `pnpm --filter @playbook-brain/web lint` ⚠️ script atual falha por pattern (`No files matching the pattern "src" were found`)
- Documentação obrigatória criada em `wiki/features/2026-02-27-middle-column-feed-channel-toggle-ai-psa-user.md`.

---

# Task: Botão de envio com atalho de teclado visível
**Status**: completed
**Started**: 2026-02-27T16:22:00-03:00

## Plan
- [x] Step 1: Atualizar UI do botão de envio para exibir atalho de teclado visível.
- [x] Step 2: Manter comportamento atual de teclado (`Enter` envia, `Shift+Enter` quebra linha).
- [x] Step 3: Validar typecheck web e atualizar wiki.

## Open Questions
- Sem bloqueios; mudança é visual no `ChatInput`.

## Progress Notes
- Skill aplicada: `workflow-orchestrator`.
- Escopo explícito do usuário: mostrar atalho de teclado no botão de envio.
- Botão de envio atualizado para mostrar indicador visual do atalho (`↵`) ao lado do ícone.
- Tooltip/aria adicionados: `Send (Enter)`.
- Comportamento de teclado mantido:
  - `Enter` envia;
  - `Shift+Enter` quebra linha.
- Verificação:
  - `pnpm --filter @playbook-brain/web typecheck` ✅

## Review
- What worked:
- Mudança visual pequena e direta no `ChatInput`, sem alterar o contrato de submit.
- What was tricky:
- Equilibrar largura do botão para exibir o atalho sem quebrar o layout compacto.
- Time taken:
- Um ciclo curto (UI + validação + wiki).

---

# Task: Campo de texto dinâmico (auto-grow até 5 linhas)
**Status**: completed
**Started**: 2026-02-27T16:14:00-03:00

## Plan
- [x] Step 1: Migrar `ChatInput` de `input` para `textarea`.
- [x] Step 2: Implementar auto-resize conforme digitação com limite de 5 linhas.
- [x] Step 3: Preservar UX de submit (Enter) com quebra de linha em `Shift+Enter`.
- [x] Step 4: Validar typecheck web e atualizar wiki.

## Open Questions
- Sem bloqueios; mudança restrita ao componente compartilhado de input.

## Progress Notes
- Skill aplicada: `workflow-orchestrator`.
- Escopo explícito do usuário: campo dinâmico em altura até 5 linhas.
- `ChatInput` agora usa `textarea` (`rows=1`) com auto-resize por `scrollHeight`.
- Limite de altura aplicado em 5 linhas; quando excede, ativa `overflowY: auto`.
- UX de teclado:
  - `Enter` envia;
  - `Shift+Enter` quebra linha.
- Verificação:
  - `pnpm --filter @playbook-brain/web typecheck` ✅

## Review
- What worked:
- Mudança isolada no componente compartilhado, refletindo automaticamente em home e sessão.
- What was tricky:
- Controlar altura dinâmica com limite fixo sem quebrar estilo existente do composer.
- Time taken:
- Um ciclo curto (implementação + typecheck + wiki).

---

# Task: Reposicionar sugestões acima do campo como tabs (popping out)
**Status**: completed
**Started**: 2026-02-27T16:02:00-03:00

## Plan
- [x] Step 1: Mover sugestões de baixo da toolbar para faixa superior do composer.
- [x] Step 2: Aplicar estilo de tab “popping out” mantendo click behavior para preencher input.
- [x] Step 3: Validar typecheck web e atualizar wiki.

## Open Questions
- Sem bloqueios para esta etapa visual.

## Progress Notes
- Skill aplicada: `workflow-orchestrator`.
- Componente alterado: `apps/web/src/components/ChatInput.tsx`.
- Sugestões passaram a renderizar acima do campo de texto, com estilo de tabs (`border-bottom: none`, raio superior) e offset negativo para efeito de “saindo do container”.
- Comportamento preservado: click em sugestão ainda preenche o input; toolbar e anexos mantidos.
- Verificação:
  - `pnpm --filter @playbook-brain/web typecheck` ✅

## Review
- What worked:
- Mudança localizada apenas no `ChatInput`, com efeito imediato nas duas telas que usam o componente.
- What was tricky:
- Ajustar offset/raio para efeito “tab” sem quebrar espaçamento interno do composer.
- Time taken:
- Um ciclo curto (ajuste visual + validação + wiki).

---

# Task: Attachment flow (Cerebro inline preview + Autotask regular attachment)
**Status**: completed
**Started**: 2026-02-27T15:38:00-03:00

## Plan
- [x] Step 1: Remover botão de imagem inline e adicionar seletor de anexos no `ChatInput`.
- [x] Step 2: Implementar endpoint/API client para upload de anexos em `TicketAttachments` no Autotask.
- [x] Step 3: Renderizar anexos inline no Cerebro (imagem como preview; documento como card com ícone + nome + formato).
- [x] Step 4: Conectar envio de anexos no fluxo da sessão de ticket e validar com testes/typecheck.
- [x] Step 5: Atualizar wiki com a mudança.

## Open Questions
- Nesta etapa, o upload será para attachment regular do ticket (não inline no texto e não vinculado a note/time entry específico).

## Progress Notes
- Skill aplicada: `workflow-orchestrator`.
- Escopo explícito do usuário: remover inline image button, wiring do botão anexo e upload no Autotask.
- Frontend:
  - `ChatInput` atualizado para seleção de múltiplos arquivos, preview inline e remoção local de anexos.
  - botão de `inline pic` removido da toolbar.
  - `ChatMessage` passou a renderizar anexos inline em mensagens do usuário:
    - imagem: preview visual;
    - documento: card retangular com ícone/extensão + nome + formato.
  - `triage/[id]` envia anexos selecionados para endpoint de upload de attachment do ticket no Autotask ao submeter mensagem.
- Backend:
  - `AutotaskClient` ganhou `createTicketAttachment`.
  - nova rota `POST /autotask/ticket/:ticketId/attachments` para upload regular de anexos no ticket (com limite de tamanho por arquivo e retorno parcial por item).
  - `express.json` ajustado para `12mb` para suportar payload base64 de anexos.
- Verificação:
  - `pnpm --filter @playbook-brain/api test -- src/__tests__/clients/autotask.test.ts` ✅
  - `pnpm --filter @playbook-brain/api typecheck` ✅
  - `pnpm --filter @playbook-brain/web typecheck` ✅

## Review
- What worked:
- Fluxo com mudança mínima: upload regular no ticket e preview inline local sem alterar contratos de workflow command existentes.
- What was tricky:
- Ajustar limite de body JSON e evitar revogar `objectURL` antes da renderização dos anexos na mensagem enviada.
- Time taken:
- Um ciclo médio (API + UI + testes + documentação).

---

# Task: Dual-channel text pipeline (rich interno + plain estruturado para Autotask)
**Status**: completed
**Started**: 2026-02-27T15:05:00-03:00

## Plan
- [x] Step 1: Implementar normalizador backend `rich/markdown/html -> plain text` compatível com payloads de note/time entry do Autotask.
- [x] Step 2: Integrar normalizador no gateway de escrita (`comment_note`, `legacy_update` com comment, `update_note`, `time_entry create/update`) preservando payload rico para projeção interna.
- [x] Step 3: Adicionar/atualizar testes do gateway para provar conversão antes do write em Autotask.
- [x] Step 4: Verificar typecheck/tests API/Web e atualizar wiki.

## Open Questions
- Nesta iteração, anexos seguem fora de escopo (placeholders de UI permanecem) e sem upload automático.

## Progress Notes
- Skill aplicada: `workflow-orchestrator`.
- Escopo autorizado pelo usuário: implementar dual-channel com conversão em background para Autotask.
- Backend:
  - novo `apps/api/src/services/autotask-text-normalizer.ts` para converter conteúdo rich/markdown/html em plain text compatível com Autotask.
  - `AutotaskTicketWorkflowGateway` agora normaliza texto antes de write em:
    - `legacy_update` (comment),
    - `comment_note` / `create_comment_note`,
    - `update_ticket_note`,
    - `time_entry` create/update (`summaryNotes`).
- Projeção interna (Cerebro):
  - `ticket-workflow-core` agora prioriza campos rich (`comment_body_rich`, `note_body_rich`, `noteText_rich`) para exibição/fingerprint local quando presentes.
- Verificação:
  - `pnpm --filter @playbook-brain/api test -- src/__tests__/services/autotask-ticket-workflow-gateway.test.ts` ✅
  - `pnpm --filter @playbook-brain/api typecheck` ✅
  - `pnpm --filter @playbook-brain/web typecheck` ✅

## Review
- What worked:
- Converter no gateway (write boundary) permitiu dual-channel sem quebrar contratos atuais de comando.
- What was tricky:
- Manter compatibilidade de aliases (`comment_body/note_body/noteText`, `summary_notes/summaryNotes`) em todos os handlers.
- Time taken:
- Um ciclo médio (RCA + implementação + testes + documentação).

---

# Task: ChatInput toolbar PSA (etapa 1 de 3)
**Status**: completed
**Started**: 2026-02-27T13:55:00-03:00

## Plan
- [x] Step 1: Mapear componente compartilhado de input nas telas de triage.
- [x] Step 2: Adicionar toolbar na área de sugestões com ações solicitadas.
- [x] Step 3: Executar verificação (typecheck web) e documentar wiki.

## Open Questions
- Sem bloqueios para etapa 1. Etapas 2 e 3 (reposicionar sugestões e textarea dinâmica) ficam para próximas mudanças.

## Progress Notes
- Skill aplicada: `workflow-orchestrator`.
- Componente alterado: `apps/web/src/components/ChatInput.tsx`.
- Toolbar adicionada com ordem solicitada:
  - anexo (placeholder), emoji, divisor vertical, bold, italic, underline, bulleted list, numbered list, inline pic (placeholder).
- Ações implementadas:
  - emoji, bold, italic, underline, lista com bullet e lista numerada aplicam formatação no texto atual.
  - botões placeholder não fazem upload/render de mídia ainda, apenas presença visual.
- Comportamento preservado:
  - submit no botão enviar e Enter.
  - chips de sugestão mantidos na posição atual para não antecipar etapa 2.

## Review
- What worked:
- Mudança isolada em componente compartilhado entregou toolbar nos dois fluxos (home e sessão) sem alterar contratos de dados.
- What was tricky:
- Garantir que todos os botões da toolbar fossem `type="button"` para não disparar submit do form por acidente.
- Time taken:
- Um ciclo curto (análise + implementação + typecheck + wiki).

---

# Task: Reviewer layer AT-wins para campos críticos (evitar split-brain Cerebro x Autotask)
**Status**: completed
**Started**: 2026-02-27T17:46:00-03:00

## Plan
- [x] Step 1: Implementar camada de reviewer no `playbook/full-flow` com overlay autoritativo do Autotask.
- [x] Step 2: Aplicar política `AT win` para campos críticos em caso de divergência.
- [x] Step 3: Blindar frontend contra overrides locais stale quando snapshot do servidor divergir.
- [x] Step 4: Verificar typecheck API/Web e atualizar wiki/lessons.

## Open Questions
- Sem bloqueios para implementação. Se houver campos adicionais de SSOT, basta expandir o overlay do reviewer.

## Progress Notes
- Skill aplicada: `workflow-orchestrator`.
- Problema reportado: ticket mostrava Tech diferente entre Cerebro e Autotask sem nova ação do operador.
- Backend:
  - novo reviewer em `GET /playbook/full-flow` busca snapshot atual no AT e aplica overlay autoritativo nos campos críticos.
  - payload agora inclui `data.authoritative_review` com divergências detectadas.
- Frontend:
  - efeito de reconciliação remove `contextOverrides` (`org/user/tech`) quando divergem do snapshot servidor.
  - evita que override local stale continue vencendo renderização.
- Campos no overlay `AT win`:
  - account/company, contact, status, priority, additional contacts, issue type, sub-issue type, source, due date, SLA, queue, primary resource, secondary resource.
- Verificação executada:
  - `pnpm --filter @playbook-brain/api typecheck` ✅
  - `pnpm --filter @playbook-brain/web typecheck` ✅

## Review
- What worked:
- Overlay autoritativo no read path + limpeza de override no UI remove divergência sem mudar semântica de write.
- What was tricky:
- Garantir compatibilidade com fallback local quando AT não disponível sem quebrar rota de leitura.
- Time taken:
- Um ciclo de arquitetura + implementação + validação.

---

# Task: Bugfix - Evitar divergência Tech entre Cerebro e Autotask (no local-save before AT confirm)
**Status**: completed
**Started**: 2026-02-27T17:34:00-03:00

## Plan
- [x] Step 1: Confirmar ponto de divergência no fluxo `update_assign`.
- [x] Step 2: Ajustar fluxo para atualização de Tech somente com confirmação `completed`.
- [x] Step 3: Em `pending/retrying/failed`, manter contexto local inalterado e exibir erro/estado.
- [x] Step 4: Verificar typecheck e atualizar wiki/lessons.

## Open Questions
- Sem bloqueios técnicos. O ticket pode continuar em processamento assíncrono; UI só aplica override local em sucesso confirmado.

## Progress Notes
- Skill aplicada: `workflow-orchestrator`.
- Causa da disparidade:
  - `submitTechAssignmentById` atualizava `contextOverrides.tech` logo após primeiro refresh de status, mesmo sem `completed`.
  - Isso permitia “Cerebro mostrar Tech novo” antes de confirmação real no Autotask.
- Correção:
  - `refreshWorkflowCommandFeedback` passou a retornar `{ ok, uxState, detail }`.
  - `submitTechAssignmentById` só seta `contextOverrides.tech` quando `ok=true` (`uxState === succeeded`).
  - Em `pending/retrying/failed`, retorna erro e mantém estado local anterior.
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅

## Review
- What worked:
- Gate explícito de confirmação remove split-brain visual/local.
- What was tricky:
- Conciliar fluxo assíncrono de comando com UX sem comprometer confiança de estado.
- Time taken:
- Um ciclo curto focado em consistência autoritativa.

---

# Task: Bugfix - Edit Tech não permite todos os recursos (restrição AssignedRole + UX de erro)
**Status**: completed
**Started**: 2026-02-27T17:18:00-03:00

## Plan
- [x] Step 1: Investigar evidência de falha nos comandos `update_assign`.
- [x] Step 2: Confirmar causa raiz de negócio no payload Autotask (resource-role mismatch).
- [x] Step 3: Corrigir UX para não fechar modal em falha e filtrar recursos não atribuíveis.
- [x] Step 4: Verificar typecheck e atualizar wiki/lessons.

## Open Questions
- Sem bloqueios técnicos. Recursos sem `defaultServiceDeskRoleID` continuam não atribuíveis até configuração no Autotask.

## Progress Notes
- Skill aplicada: `workflow-orchestrator`.
- Evidência de runtime (`apps/api/.run/p0-workflow-runtime.json`):
  - erro recorrente: `Data violation: The specified assignedResourceID and AssignedRoleID combination is not currently defined`.
- Probe de recursos:
  - recurso que falha (`29683515`) possui `defaultServiceDeskRoleID = null`.
  - recursos que funcionam possuem `defaultServiceDeskRoleID` preenchido.
- Correções:
  - Frontend `Edit Tech`: não fecha modal quando assign falha; erro fica visível no modal.
  - API `/autotask/resources/search`: retorna apenas recursos ativos com `defaultServiceDeskRoleID` válido (evita opções sabidamente inválidas no assign).
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
  - `pnpm --filter @playbook-brain/api typecheck` ✅

## Review
- What worked:
- Combinação de evidência operacional + filtro preventivo remove tentativa inválida na UI.
- What was tricky:
- O problema era parcialmente funcional (alguns recursos funcionavam) e parecia intermitente sem ler o erro bruto do provider.
- Time taken:
- Um ciclo de RCA com ajuste de UX e contrato de listagem.

---

# Task: Bugfix - Edit Tech não aplica seleção (command_id parsing)
**Status**: completed
**Started**: 2026-02-27T17:05:00-03:00

## Plan
- [x] Step 1: Reproduzir caminho de seleção de Tech e mapear fluxo de submit do comando.
- [x] Step 2: Confirmar contrato real da resposta `/workflow/commands` e causa raiz no parsing do frontend.
- [x] Step 3: Corrigir extração de `command_id` no frontend com compatibilidade de formatos.
- [x] Step 4: Verificar typecheck e atualizar wiki/lessons.

## Open Questions
- Sem bloqueios: causa raiz confirmada por leitura de contrato rota + consumidor.

## Progress Notes
- Skill aplicada: `workflow-orchestrator`.
- Root cause:
  - Frontend lia apenas `response.command_id`.
  - Backend retorna attempt com `response.command.command_id`.
  - Resultado: erro `Workflow command id missing`, sem update de Tech e modal fechando após await.
- Correção:
  - Extração de `command_id` agora aceita ambos formatos (`command_id` e `command.command_id`).
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅

## Review
- What worked:
- Fix mínimo e direto no ponto de quebra do contrato de resposta.
- What was tricky:
- Divergência de shape entre tipagem frontend e envelope real da API.
- Time taken:
- Um ciclo curto de RCA + patch + validação.

---

# Task: Bugfix - Refresh Technologies sem listagem de users (investigação payload + docs)
**Status**: completed
**Started**: 2026-02-27T16:40:00-03:00

## Plan
- [x] Step 1: Reproduzir e capturar payloads reais de companies/contacts/resources para Refresh no backend.
- [x] Step 2: Validar semântica de filtro/fields da API Autotask via documentação (Context7) e comparar com implementação atual.
- [x] Step 3: Corrigir causa raiz na rota/cliente/UI da dependência Org -> User.
- [x] Step 4: Verificar com typecheck + prova de payload para Refresh e atualizar wiki/lessons.

## Open Questions
- Resolvido: existem múltiplas companies "Refresh", incluindo `Refresh Technologies` com `id = 0`.
- Resolvido: o frontend tratava `0` como falsy e quebrava a dependência `Org -> User`.

## Progress Notes
- Skill aplicada: `workflow-orchestrator`.
- Investigação de payload (Autotask client direto com credenciais de `integration_credentials`):
  - `Refresh Technologies` retornou `companyID = 0` (ativa).
  - `contacts/query` por `companyID = 0` retornou 66 contatos (ou seja, dados existem).
- Documentação:
  - Context7 não possui biblioteca da Autotask REST API neste ambiente (tentativas: `Autotask REST API`, `Datto Autotask`).
  - Fallback para docs oficiais Autotask confirmou padrão de query e IDs válidos (exemplo oficial inclui `Companies/0`).
- Correção aplicada em `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`:
  - `toPositiveId` -> `toAutotaskId` com aceitação de `>= 0`.
  - Condições de `activeOrgId` migradas de truthy/falsy para `null` checks.
  - Propagação de `updated.companyId` ajustada para aceitar `0`.
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
  - `pnpm --filter @playbook-brain/api typecheck` ✅

## Review
- What worked:
- Root cause dirigido por evidência real de payload eliminou tentativa/erro e apontou exatamente o bug de truthiness.
- What was tricky:
- O caso era restrito a uma org com ID atípico (`0`), então passava despercebido em validações com IDs positivos.
- Time taken:
- Um ciclo de investigação + correção com validação de contrato/dados.

---

# Task: Bugfix - Refresh Technologies não destrava Edit User após seleção de Org
**Status**: completed
**Started**: 2026-02-27T13:47:00-03:00

## Plan
- [x] Step 1: Confirmar que o bloqueio persiste apenas no caso Refresh.
- [x] Step 2: Tornar seleção de Org otimista no frontend para garantir dependência `User -> Org` imediata.
- [x] Step 3: Manter write no Autotask como best-effort e sinalizar falha sem bloquear fluxo.
- [x] Step 4: Validar typecheck e atualizar wiki/lessons.

## Open Questions
- Sem bloqueios técnicos. A persistência final continua garantida quando usuário seleciona contato (update company+contact no backend).

## Progress Notes
- Skill aplicada: `workflow-orchestrator`.
- Causa raiz prática: em cenários específicos (Refresh), write intermediário de Org pode falhar por validações do Autotask; antes disso bloqueava a etapa de User.
- Fix: seleção de Org agora aplica override local imediatamente; mesmo com falha de write, User modal recebe org selecionada e pode seguir.
- Erro de write é exposto como aviso em `workflowActionError` em vez de bloquear fluxo.
- Verificação executada:
  - `pnpm --filter @playbook-brain/web typecheck` ✅
  - `pnpm --filter @playbook-brain/api typecheck` ✅

## Review
- What worked:
- O fluxo ficou resiliente para cenários de validação intermediária sem perder dependência funcional Org->User.
- What was tricky:
- Balancear consistência de write com UX operacional contínua.
- Time taken:
- Um ciclo de correção pragmática focada no caso real reportado.
