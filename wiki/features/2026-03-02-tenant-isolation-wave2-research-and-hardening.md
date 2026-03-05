# Tenant Isolation Wave 2: Research + Hardening
# What changed
- Pesquisa técnica aplicada com base em fontes oficiais (PostgreSQL e OWASP) para isolamento de tenant.
- Reforço de tenant scoping em fluxos restantes:
- `auth` rotas autenticadas de usuário (`mfa/setup|enable|disable`, `me`, `me/profile`, `invite actor lookup`) agora usam `tenant_id` explícito.
- `workflow-runtime` usa `tenant_id` no lookup de credencial Autotask.
- `client-resolver` removeu fallback para credencial global “latest”.
- `ticket-intake` passou a exigir autenticação e lookup tenant-scoped para credenciais de sidebar.
- `autotask-polling` restringiu DB lookup ao tenant explicitamente configurado por env.

# Why it changed
- Completar varredura de isolamento após incidente de vazamento em Team/Connections.
- Eliminar bypasses por fallback global de credenciais.

# Impact (UI / logic / data)
- UI: workspaces novos não herdam status/conectores de outro tenant.
- Logic: enforced tenant boundary em mais caminhos de execução.
- Data: sem migração; mudanças em queries e controle de fluxo.

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
