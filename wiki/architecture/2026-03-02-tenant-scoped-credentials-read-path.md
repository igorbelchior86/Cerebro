# Tenant-Scoped Credentials Read Path
# What changed
- O read-path de credenciais de integração foi normalizado para chave composta `(tenant_id, service)` nas rotas de Settings e nos handlers de uso operacional.
- Rotas autenticadas deixaram de depender de suposição de RLS implícita.

# Why it changed
- O vazamento apareceu porque consultas por `service` sem `tenant_id` retornavam credenciais de outro tenant.

# Impact (UI / logic / data)
- UI: status de conectores é isolado por tenant.
- Logic: seleção de credencial foi alinhada ao boundary de tenant no request context.
- Data: nenhuma alteração de schema.

# Files touched
- apps/api/src/services/application/route-handlers/integrations-route-handlers.ts
- apps/api/src/services/application/route-handlers/autotask-route-handlers.ts
- apps/api/src/services/application/route-handlers/chat-route-handlers.ts
- apps/api/src/services/application/route-handlers/playbook-route-handlers.ts
- apps/api/src/services/application/route-handlers/auth-route-handlers.ts

# Date
- 2026-03-02
