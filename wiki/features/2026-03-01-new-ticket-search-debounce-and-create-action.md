# Title
Debounce de busca no draft e criação real de ticket pelo botão verde

# What changed
- O modal de busca do `New Ticket` agora faz debounce nas buscas remotas (`Org`, `Contact`, `Additional contacts`, `Primary`, `Secondary`) e cancela a carga inicial vazia se o usuário digitar antes dela disparar.
- O botão verde de aceite no header do draft passou a enviar um comando real de criação de ticket via `workflow/commands` com `command_type: create`.
- O create path agora propaga também campos opcionais do draft quando presentes: `assignedResourceID`, `secondaryResourceID`, `priority`, `issueType`, `subIssueType` e `serviceLevelAgreementID`.
- Após criação concluída, a UI redireciona para o ticket recém-criado.
- Ajuste mínimo de tipagem em `itglue-fetcher.ts` para restaurar o `api` typecheck sem alterar comportamento.

# Why it changed
- A busca inicial vazia do modal competia com a busca digitada, gerando requests simultâneos e 429 no Autotask.
- O botão verde existia apenas como aceite local, sem efetivamente criar o ticket no sistema-fonte.
- A verificação completa do backend estava bloqueada por um erro de tipagem não funcional em `itglue-fetcher.ts`.

# Impact (UI / logic / data)
- UI: o modal de busca fica mais estável durante a digitação e o botão verde passa a representar uma ação real.
- Logic: o draft usa write-through para criação via pipeline auditado de workflow, mantendo idempotência e auditoria.
- Data: tickets novos passam a ser criados no Autotask pelo fluxo de `New Ticket`; os campos opcionais selecionados no draft entram no payload de criação quando disponíveis.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `apps/web/src/lib/p0-ui-client.ts`
- `apps/api/src/services/autotask-ticket-workflow-gateway.ts`
- `apps/api/src/services/data-fetchers/itglue-fetcher.ts`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
2026-03-01
