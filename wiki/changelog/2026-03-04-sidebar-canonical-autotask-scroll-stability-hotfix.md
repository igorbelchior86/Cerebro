# Sidebar canonical Autotask + scroll stability hotfix
# What changed
- Removido shimmer por campo nos cards da sidebar (`company`/`requester`): render agora é valor canônico ou `—`.
- Removida animação FLIP de reordenação da lista de tickets na sidebar para eliminar disputa visual durante scroll/polling.
- Ajustada a priorização de dados no triage para `Org` e `Contact`: agora prioriza `data.ticket` (fonte Autotask) antes de heurísticas de `ssot/affected_user`.
- `ChatSidebar` no triage deixou de depender do `loading` do playbook para estado de loading da lista de tickets.
- Polling de inbox no `triage/home` foi condicionado a `isActive`, evitando requests em background quando draft está oculto.

# Why it changed
- O comportamento anterior mantinha shimmer parcial indefinido e aplicava transforms de reordenação durante atualização, gerando sensação de “shimmer eterno” e corrida com scroll.
- Alguns campos de contexto do triage ainda priorizavam fontes derivadas/heurísticas antes da cópia canônica do Autotask, causando inconsistência visual.

# Impact (UI / logic / data)
- UI: cards estáveis sem shimmer por campo; scroll da lista sem “puxões” por animação de reordenação.
- Logic: resolução de Org/Contact com prioridade explícita para dados canônicos do ticket Autotask.
- Data: sem mudança de schema; mudança de precedência de leitura e de gatilho de polling no cliente.

# Files touched
- apps/web/src/features/chat/sidebar/ChatSidebar.tsx
- apps/web/src/features/chat/sidebar/SidebarTicketCard.tsx
- apps/web/src/features/chat/sidebar/types.ts
- apps/web/src/lib/workflow-sidebar-adapter.ts
- apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- apps/web/src/app/[locale]/(chat)/triage/home/page.tsx
- tasks/todo.md
- tasks/lessons.md

# Date
- 2026-03-04
