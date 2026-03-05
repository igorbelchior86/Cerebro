# Tenant ID Mandatory in Every Authenticated Data Path
# What changed
- Decisão consolidada: qualquer read/write sensível em rota autenticada deve incluir `tenant_id` explicitamente no SQL.
- Decisão complementar: fallback global de credenciais (`latest`/`.env`) não é permitido em fluxos tenant-scoped.

# Why it changed
- Incidente de vazamento mostrou que middleware/JWT sem predicado SQL explícito não garante isolamento de dados.

# Impact (UI / logic / data)
- UI: elimina herança indevida de dados entre workspaces.
- Logic: simplifica auditoria de segurança (regra objetiva por query).
- Data: sem impacto de schema.

# Files touched
- apps/api/src/services/application/route-handlers/auth-route-handlers.ts
- apps/api/src/services/application/route-handlers/ticket-intake-route-handlers.ts
- apps/api/src/services/context/client-resolver.ts
- apps/api/src/services/orchestration/workflow-runtime.ts
- apps/api/src/services/adapters/autotask-polling.ts

# Date
- 2026-03-02
