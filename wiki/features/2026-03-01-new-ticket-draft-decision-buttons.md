# Title
Botões de aceitar e rejeitar no header do draft de new ticket

# What changed
- Adicionados dois botões redondos no lado direito da mesma row de `Primary` e `Secondary` no fluxo `New Ticket`.
- O botão de aceite usa ícone de check verde.
- O botão de rejeição usa ícone de X vermelho.
- O botão de rejeição descarta o draft local com `resetDraft`.
- O botão de aceite mantém apenas o aceite local do draft e fecha editores abertos, sem criar ticket no provider nesta etapa.

# Why it changed
- A shell de `New Ticket` não tinha controles visuais de aceitar/rejeitar no ponto final da preparação do draft.
- O objetivo era manter a UI mais próxima do fluxo esperado sem introduzir, ainda, escrita nova no Autotask.

# Impact (UI / logic / data)
- UI: a row de assignment técnico agora inclui ações visuais de decisão do draft.
- Logic: `Discard` limpa o draft local; `Accept` apenas consolida visualmente o draft local.
- Data: nenhuma persistência nova; nenhum write no Autotask.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `tasks/todo.md`

# Date
2026-03-01
