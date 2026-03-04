# Triage home sidebar fetch regression fix
# What changed
- Ajustado o gating de polling da sidebar em `triage/home` para diferenciar modo embutido (draft layer) da rota standalone.
- `loadTriPaneSidebarTickets` agora roda quando a página está standalone, mesmo fora do modo compose.
- Em modo embutido/oculto (`triage/[id]` com bridge inativa), o polling continua bloqueado para evitar fanout de requests.

# Why it changed
- O guard anterior baseado apenas em `isActive` bloqueou também o caso standalone, causando ausência total de `GET /workflow/inbox` e lista vazia.

# Impact (UI / logic / data)
- UI: a sidebar em `/triage/home` volta a carregar os cards normalmente.
- Logic: polling condicionado por `shouldLoadSidebarTickets = !isEmbeddedWorkspace || isActive`.
- Data: sem mudança de schema/API; apenas correção de condição de execução no cliente.

# Files touched
- apps/web/src/app/[locale]/(chat)/triage/home/page.tsx
- tasks/todo.md
- tasks/lessons.md

# Date
- 2026-03-04
