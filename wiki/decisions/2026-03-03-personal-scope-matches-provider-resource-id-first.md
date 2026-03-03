# Personal Scope Matches Provider Resource ID First
# What changed
- Decisão de matching para aba Personal formalizada:
- prioridade 1: `assigned_resource_id` vs `user.preferences.autotaskResourceId`
- prioridade 2: email
- prioridade 3: nome
- Decisão de resiliência formalizada:
- quando não houver metadado suficiente para match confiável, não esconder tickets por filtro estrito.

# Why it changed
- O provider (Autotask) retorna assignee frequentemente como ID numérico.
- Match somente textual gerava falso negativo e lista pessoal vazia mesmo com tickets atribuídos.

# Impact (UI / logic / data)
- UI: Personal deixa de depender de heurística frágil por nome.
- Logic: filtro determinístico e auditável para assignee.
- Data: requer `autotaskResourceId` em `users.preferences` para melhor precisão.

# Files touched
- apps/web/src/features/chat/sidebar/useSidebarState.ts
- apps/web/src/lib/workflow-sidebar-adapter.ts

# Date
- 2026-03-03
