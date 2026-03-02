# Explicit Tenant Filters (No Implicit RLS Assumptions)
# What changed
- Decisão de engenharia: toda query em superfícies multi-tenant autenticadas deve carregar `tenant_id` explícito no predicado SQL.
- Comentários/assunções de “RLS cuida disso” não são suficientes sem enforcement real na camada de acesso.

# Why it changed
- Incidente real de vazamento cross-tenant em Team/Connections causado por queries sem filtro de tenant.

# Impact (UI / logic / data)
- UI: isolamento previsível entre workspaces.
- Logic: menor risco de regressão silenciosa em novos handlers.
- Data: sem impacto de schema.

# Files touched
- apps/api/src/services/application/route-handlers/auth-route-handlers.ts
- apps/api/src/services/application/route-handlers/integrations-route-handlers.ts
- apps/api/src/services/application/route-handlers/autotask-route-handlers.ts
- apps/api/src/services/application/route-handlers/chat-route-handlers.ts
- apps/api/src/services/application/route-handlers/playbook-route-handlers.ts

# Date
- 2026-03-02
