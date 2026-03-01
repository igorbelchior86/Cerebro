# New Ticket Return To Queue Context
# What changed
- `ChatSidebar` agora persiste mais contexto de UI no `sessionStorage`: `scope`, busca e queue global, além de `filter` e `scrollTop`.
- O botão `New Ticket` passou a enviar o `returnTicketId` do primeiro ticket visível no sidebar ao navegar para `/triage/home`.
- A tela de `New Ticket` em `/triage/home` agora usa esse `returnTicketId` no dismiss: o `X` limpa o draft e volta para o ticket-alvo em `/triage/[id]`.

# Why it changed
- Ao abrir `New Ticket` a navegação para outra rota remontava a shell; como o sidebar só persistia parte do estado, o contexto selecionado parecia “sumir”.
- No dismiss, o draft só era resetado localmente, então o operador ficava preso na interface de criação em vez de retornar ao fluxo de fila.

# Impact (UI / logic / data)
- UI: o contexto do sidebar sobrevive melhor à troca para `New Ticket`, e o dismiss retorna ao topo visível da fila/filtro atual em vez de apenas limpar campos.
- Logic: a transição para `New Ticket` agora carrega um ticket de retorno explícito; o draft consome esse parâmetro para fechar corretamente.
- Data: nenhuma mudança de backend, schema ou payload persistido.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatSidebar.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/home/page.tsx

# Date
- 2026-03-01
