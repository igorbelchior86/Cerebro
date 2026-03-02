# Hotfix Tenant Isolation: Team + Connections
# What changed
- `GET /auth/team` passou a exigir `tenant_id` explícito na query de membros.
- `GET /integrations/credentials`, `GET /integrations/health` e `DELETE /integrations/credentials/:service` agora usam `(tenant_id, service)` em vez de apenas `service`.
- Leitura de credenciais em handlers críticos (`autotask`, `chat`, `playbook`) foi ajustada para buscar apenas no tenant corrente via `tenantContext`.

# Why it changed
- Usuário de tenant novo visualizava dados de outro tenant em Settings (Team e Connections), caracterizando vazamento cross-tenant.

# Impact (UI / logic / data)
- UI: `Team` mostra apenas membros do tenant logado; `Connections` mostra estado real desse tenant.
- Logic: lookup de credenciais e listagem de membros agora são tenant-scoped.
- Data: sem migração; somente correção de leitura/escrita.

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
