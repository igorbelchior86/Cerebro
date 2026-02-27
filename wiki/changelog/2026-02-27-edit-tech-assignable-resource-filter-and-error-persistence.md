# Title
2026-02-27: Edit Tech com filtro de atribuibilidade e feedback de erro persistente

# What changed
- `Edit Tech` não fecha modal quando comando de assign falha.
- Mensagem de erro de assignment agora aparece e permanece no modal.
- Busca de recursos do Autotask exclui recursos sem `defaultServiceDeskRoleID`.

# Why it changed
- Alguns techs apareciam na lista mas eram rejeitados pelo Autotask por combinação inválida de recurso/role.

# Impact (UI / logic / data)
- UI: fluxo previsível, sem falha silenciosa.
- Logic: opções listadas passam a ser compatíveis com o write path de assignment.
- Data: sem alterações estruturais.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `apps/api/src/routes/autotask.ts`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
2026-02-27
