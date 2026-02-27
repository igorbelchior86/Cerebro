# Title
2026-02-27: Correção do Edit Tech (parsing de command_id)

# What changed
- Corrigida extração de `command_id` no submit de `Edit Tech`.
- Frontend agora aceita formatos flat e nested do retorno de `/workflow/commands`.

# Why it changed
- O modal fechava após submit, mas Tech não era atualizado porque o comando era tratado como sem `command_id`.

# Impact (UI / logic / data)
- UI: seleção de Tech deixa de falhar silenciosamente.
- Logic: fluxo `update_assign` mantém polling e feedback com ID de comando válido.
- Data: sem mudanças estruturais.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
2026-02-27
