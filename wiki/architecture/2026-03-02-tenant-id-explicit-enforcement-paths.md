# Tenant ID Explicit Enforcement Paths
# What changed
- Tenant boundary foi reforçado para além dos endpoints de Settings:
- camada de identidade (`auth`) com `tenant_id` em queries de usuário autenticado.
- camada de contexto (`client-resolver`) sem fallback global de credenciais.
- camada de workflow (`workflow-runtime`) com lookup tenant-scoped.
- camada de ingest/list (`ticket-intake`) protegida por auth e credencial tenant-scoped.

# Why it changed
- A arquitetura dependia parcialmente de suposição de isolamento implícito; isso gerava risco de bleed quando queries não traziam tenant no predicado.

# Impact (UI / logic / data)
- UI: consistência por workspace em Team/Connections e fluxos derivados.
- Logic: boundary enforcement uniforme entre API routes e services.
- Data: sem alteração de schema.

# Files touched
- apps/api/src/index.ts
- apps/api/src/services/application/route-handlers/auth-route-handlers.ts
- apps/api/src/services/application/route-handlers/ticket-intake-route-handlers.ts
- apps/api/src/services/context/client-resolver.ts
- apps/api/src/services/orchestration/workflow-runtime.ts
- apps/api/src/services/adapters/autotask-polling.ts

# Date
- 2026-03-02
