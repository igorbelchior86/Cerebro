# Title
Fix: seleção de Org otimista para destravar Edit User (caso Refresh)

# What changed
- No frontend, seleção de `Org` passou a aplicar override local imediatamente (modo otimista).
- Write de `Org` no Autotask continua sendo tentado, mas falha não bloqueia abertura/listagem de `User`.
- Em falha de write, o sistema exibe aviso operacional (`workflowActionError`) em vez de interromper o fluxo.

# Why it changed
- No caso `Refresh Technologies`, a validação intermediária do Autotask podia impedir a persistência imediata de org e bloquear a etapa seguinte (`Edit User`).

# Impact (UI / logic / data)
- UI: dependência `User -> Org` funciona imediatamente após seleção de org.
- Logic: write externo virou best-effort no passo intermediário de org.
- Data: persistência externa continua ocorrendo; falhas intermediárias ficam explícitas para operador.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/lessons.md`

# Date
2026-02-27
