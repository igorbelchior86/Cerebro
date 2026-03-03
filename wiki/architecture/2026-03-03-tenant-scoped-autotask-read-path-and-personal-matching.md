# Tenant-Scoped Autotask Read Path and Personal Matching
# What changed
- O read path de Autotask nos route handlers passou a receber tenant do request autenticado (`req.auth.tid`) no resolver de cliente.
- O pipeline da sidebar foi ajustado para distinguir identidade de assignee por:
- `assigned_resource_id` (provider resource id numérico)
- `assigned_resource_name` (texto)
- O filtro Personal usa ordem determinística de matching: resource ID -> email -> nome.

# Why it changed
- O fluxo anterior assumia metadado textual de assignee e não tratava corretamente o formato numérico vindo do inbox.
- A ausência de tenant explícito no resolver de client deixava endpoints read-only sensíveis a falhas de contexto.

# Impact (UI / logic / data)
- UI: filas e agrupamentos por queue passam a ter label consistente via catálogo.
- Logic: boundary de tenant explícito no caminho de leitura Autotask.
- Data: nenhuma migração; apenas ajuste de preferência de usuário para paridade de demo.

# Files touched
- apps/api/src/services/application/route-handlers/autotask-route-handlers.ts
- apps/web/src/lib/workflow-sidebar-adapter.ts
- apps/web/src/features/chat/sidebar/useSidebarState.ts

# Date
- 2026-03-03
