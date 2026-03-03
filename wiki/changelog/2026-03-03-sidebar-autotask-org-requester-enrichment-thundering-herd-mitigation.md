# Title
Mitigação de thundering herd no enriquecimento de Org/Requester da sidebar Global

# What changed
- O fallback de enriquecimento de `companyID/contactID` no endpoint `GET /autotask/sidebar-tickets` deixou de usar fanout irrestrito por `Promise.allSettled`.
- Foi adicionado limite de concorrência (`SIDEBAR_ENRICHMENT_CONCURRENCY_LIMIT=4`) para chamadas `getCompany/getContact`.
- Foi adicionado cache compartilhado em memória com TTL curto (`SIDEBAR_ENRICHMENT_CACHE_TTL_MS=60000`) + deduplicação in-flight entre requests.
- As chaves de cache/in-flight são tenant-scoped (`tenant:kind:id`) e o endpoint passa `req.auth?.tid` para o resolvedor.

# Why it changed
- Sob concorrência (múltiplos usuários/abas em Global), o fanout simultâneo para os mesmos IDs pressionava o rate-limit do Autotask.
- O resultado era degradação intermitente para `Unknown org/requester`, aumento de latência e instabilidade no fluxo pesado.

# Impact (UI / logic / data)
- UI: reduz intermitência de `Unknown` em org/requester nos cards da sidebar Global.
- Logic: reduz fanout externo e colapsa requisições duplicadas concorrentes para a mesma entidade.
- Data: sem migração; cache é efêmero em memória por processo com TTL curto.

# Files touched
- `apps/api/src/services/application/route-handlers/autotask-route-handlers.ts`
- `tasks/todo.md`
- `wiki/changelog/2026-03-03-sidebar-autotask-org-requester-enrichment-thundering-herd-mitigation.md`

# Date
2026-03-03
