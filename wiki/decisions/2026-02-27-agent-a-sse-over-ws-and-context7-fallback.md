# Title
Decision: SSE Preferred + Context7 Fallback Local

# What changed
- Escolha de SSE como transporte realtime principal para inbox/ticket state changes.
- Reconexão com backoff implementada no frontend via `EventSource` re-open controlado.
- Documentado fallback local de documentação por indisponibilidade do Context7 MCP no ambiente.

# Why it changed
- SSE atende stream unidirecional de eventos de estado com menor complexidade operacional que WS para este escopo.
- Requisitos pediam fallback claro para polling quando realtime falhar; SSE integra bem com esse padrão.
- Context7 MCP não estava acessível via recursos/templates MCP nesta execução.

# Impact (UI / logic / data)
- UI: recebe push quando disponível; troca para polling quando degradado, com sinal explícito.
- Logic: adiciona policy de reconnect e estado `degraded` no hook.
- Data: nenhum impacto em persistência.

# Files touched
- `apps/web/src/hooks/usePollingResource.ts`
- `apps/api/src/services/workflow-realtime.ts`
- `tasks/todo.md`

# Date
2026-02-27
