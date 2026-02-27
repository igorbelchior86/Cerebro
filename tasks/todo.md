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
