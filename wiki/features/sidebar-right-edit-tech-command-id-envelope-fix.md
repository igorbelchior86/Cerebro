# Title
Fix: Edit Tech aplica seleção com parsing compatível de `command_id`

# What changed
- Ajustado o fluxo de submit de `Edit Tech` para extrair `command_id` em dois formatos de resposta:
  - `response.command_id`
  - `response.command.command_id`
- Mantido restante do fluxo de assignment/polling sem alterações estruturais.

# Why it changed
- A API `/workflow/commands` retorna envelope de `attempt` (com `command.command_id`).
- O frontend esperava apenas `command_id` no topo, disparava erro `Workflow command id missing` e não aplicava override de Tech.

# Impact (UI / logic / data)
- UI: selecionar um Tech no modal passa a refletir corretamente no card de contexto.
- Logic: submit de assignment fica compatível com envelope real do workflow API.
- Data: sem mudança de schema; sem alteração de payload persistido.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
2026-02-27
