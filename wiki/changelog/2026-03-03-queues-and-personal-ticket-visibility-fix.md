# Queues and Personal Ticket Visibility Fix
# What changed
- Corrigido erro de resolução tenant-scoped para endpoints read-only de Autotask (`/autotask/queues` e correlatos).
- Corrigido parsing de assignee no adapter da sidebar para preservar IDs numéricos de recurso.
- Corrigido filtro da aba Personal para considerar `autotaskResourceId` e resolver labels de queue por catálogo.
- Atualizada paridade do usuário `igor@refreshtech.com` com resource ID Autotask para validar o fluxo end-to-end.

# Why it changed
- Resolver regressão reportada em demo:
- queues vazias mesmo com conexão visível.
- aba Personal sem tickets atribuídos ao usuário.

# Impact (UI / logic / data)
- UI: exibição consistente de queues e tickets pessoais.
- Logic: melhor alinhamento entre payload de inbox e identidade de assignee.
- Data: `users.preferences.autotaskResourceId` atualizado para conta de demo.

# Files touched
- apps/api/src/services/application/route-handlers/autotask-route-handlers.ts
- apps/web/src/features/chat/sidebar/useSidebarState.ts
- apps/web/src/lib/workflow-sidebar-adapter.ts
- tasks/todo.md

# Date
- 2026-03-03
