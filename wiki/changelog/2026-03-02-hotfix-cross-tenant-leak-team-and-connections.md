# Hotfix: Cross-Tenant Leak in Team and Connections
# What changed
- Corrigido `GET /auth/team` para filtrar por `tenant_id`.
- Corrigidos endpoints de integrations (`credentials`, `health`, `delete`) para lookup/deleção com `tenant_id`.
- Corrigidos helpers de credenciais em rotas de `autotask`, `chat` e `playbook` para tenant scoping.

# Why it changed
- Novo tenant (`igor@refreshtech.com`) conseguia visualizar membros e conectores de outro tenant.

# Impact (UI / logic / data)
- UI: dados de Team/Connections isolados por tenant.
- Logic: elimina leitura cruzada por `service` sem tenant.
- Data: sem migração; alteração apenas de código.

# Files touched
- apps/api/src/services/application/route-handlers/auth-route-handlers.ts
- apps/api/src/services/application/route-handlers/integrations-route-handlers.ts
- apps/api/src/services/application/route-handlers/autotask-route-handlers.ts
- apps/api/src/services/application/route-handlers/chat-route-handlers.ts
- apps/api/src/services/application/route-handlers/playbook-route-handlers.ts
- tasks/todo.md
- tasks/lessons.md

# Date
- 2026-03-02
