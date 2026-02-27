# Title
2026-02-27: Remoção de save local prematuro para Tech

# What changed
- Atualização local de Tech agora acontece somente após comando `update_assign` concluído com sucesso no Autotask.
- Estados de comando não concluído (`pending/retrying/failed`) não alteram contexto local de Tech.

# Why it changed
- Evitar divergência entre UI do Cerebro e estado real do ticket no Autotask.

# Impact (UI / logic / data)
- UI: sem “falso sucesso” em Tech assignment.
- Logic: fluxo passou de otimista para autoritativo no campo Tech.
- Data: sem alteração estrutural.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
2026-02-27
