# New Ticket Inline Shell Mode
# What changed
- O fluxo principal de `New Ticket` em `/triage/[id]` deixou de navegar para `/triage/home` e agora abre um modo de draft inline dentro da mesma shell tri-pane.
- A página de draft (`/triage/home`) passou a consumir um bridge de contexto opcional para reutilizar a mesma workspace de criação tanto em modo standalone quanto inline.
- Foi adicionado um provider local de bridge (`new-ticket-workspace-context`) para delegar `dismiss`, seleção de ticket e navegação pós-criação sem acoplar a workspace de draft à rota.

# Why it changed
- Mesmo com persistência de estado, a navegação para `/triage/home` continuava remontando toda a UI e quebrando a sensação de “desktop app”.
- O problema real era arquitetural: `New Ticket` estava modelado como outra página, quando o fluxo exigia apenas trocar o modo da workspace atual.

# Impact (UI / logic / data)
- UI: abrir e fechar `New Ticket` a partir da tela de ticket não reconstrói mais a shell principal; a troca agora é imediata e local.
- Logic: `/triage/[id]` mantém o ticket atual em memória e alterna para um modo inline de draft; ao dismiss, volta ao ticket anterior sem route transition.
- Data: nenhuma alteração de backend, storage ou schema.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/home/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/new-ticket-workspace-context.tsx

# Date
- 2026-03-01
