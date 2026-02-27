# Title
Fix: Edit Tech mostra apenas recursos atribuíveis e mantém modal aberto em falha

# What changed
- Ajustado o submit de `Edit Tech` para retornar status explícito (`ok/error`).
- Em erro de assignment, o modal não fecha mais; a mensagem permanece visível no próprio editor.
- Endpoint `GET /autotask/resources/search` agora filtra recursos para incluir apenas ativos com `defaultServiceDeskRoleID` válido.

# Why it changed
- Parte dos techs falhava no write com erro do Autotask:
  - `Data violation: The specified assignedResourceID and AssignedRoleID combination is not currently defined.`
- Recursos sem role padrão eram exibidos, mas não podiam ser atribuídos nesse fluxo.

# Impact (UI / logic / data)
- UI: evita sumiço do modal em falha e evita seleção de recursos sabidamente inválidos.
- Logic: lista de Tech passa a refletir pré-condições reais do write de assignment.
- Data: sem mudança de schema.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `apps/api/src/routes/autotask.ts`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
2026-02-27
