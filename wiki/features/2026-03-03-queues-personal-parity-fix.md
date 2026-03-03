# Queues + Personal Parity Fix
# What changed
- Corrigido o fluxo de leitura de credenciais Autotask para usar tenant explícito do request em endpoints de leitura.
- Corrigido adapter da sidebar para mapear `assigned_to` numérico como `assigned_resource_id` (não como nome).
- Corrigido filtro da aba Personal para priorizar match por `autotaskResourceId` e degradar com segurança quando metadados de paridade estiverem incompletos.
- Adicionada resolução de label de queue por catálogo (`/autotask/queues`) quando `queue_name` não vem no inbox.
- Aplicada paridade operacional para demo: `igor@refreshtech.com` -> `preferences.autotaskResourceId=30684582`.

# Why it changed
- Resolver os sintomas reportados:
- queues não populando para tenant novo apesar de conector configurado.
- aba Personal não exibindo tickets atribuídos ao usuário por assignee ID.

# Impact (UI / logic / data)
- UI: aba Personal volta a exibir tickets atribuídos quando existe paridade de recurso.
- Logic: rotas read-only de Autotask passam a resolver credenciais por tenant autenticado.
- Data: atualização em `users.preferences` para paridade de conta no usuário de demo.

# Files touched
- apps/api/src/services/application/route-handlers/autotask-route-handlers.ts
- apps/web/src/lib/workflow-sidebar-adapter.ts
- apps/web/src/features/chat/sidebar/useSidebarState.ts
- tasks/todo.md

# Date
- 2026-03-03
