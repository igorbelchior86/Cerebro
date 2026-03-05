# Tenant Isolation Wave 2 Full Route Scan
# What changed
- Wave 2 de hardening multi-tenant aplicada após varredura de rotas/serviços.
- Foram corrigidos:
- queries de usuário autenticado sem `tenant_id` no `auth-route-handlers`.
- lookup de credenciais sem tenant em `workflow-runtime` e `ticket-intake`.
- fallback global em `client-resolver` para evitar bleed cross-tenant.
- endpoint `/ticket-intake/*` passou a exigir `requireAuth`.
- polling de Autotask no DB agora respeita tenant explícito configurado.

# Why it changed
- Endurecer isolamento tenant em todo backend após evidência de vazamento.

# Impact (UI / logic / data)
- UI: Team/Connections e fluxos de contexto refletem apenas o tenant ativo.
- Logic: reduz risco de regressão cross-tenant em novos handlers.
- Data: sem mudanças de schema.

# Files touched
- apps/api/src/index.ts
- apps/api/src/services/application/route-handlers/auth-route-handlers.ts
- apps/api/src/services/application/route-handlers/ticket-intake-route-handlers.ts
- apps/api/src/services/context/client-resolver.ts
- apps/api/src/services/orchestration/workflow-runtime.ts
- apps/api/src/services/adapters/autotask-polling.ts
- tasks/todo.md
- tasks/lessons.md

# Date
- 2026-03-02
