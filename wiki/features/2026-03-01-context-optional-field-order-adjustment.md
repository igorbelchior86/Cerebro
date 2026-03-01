# Title
Reordenação dos campos opcionais no card de contexto

# What changed
- Reordenei os quatro campos opcionais do card de contexto para a sequência:
  - `Issue Type`
  - `Sub-Issue Type`
  - `Priority`
  - `Service Level Agreement`
- A mesma ordem foi aplicada em `triage/home` e `triage/[id]`.

# Why it changed
- O pedido foi ajustar apenas a ordem visual dos campos, sem alterar lógica, dados ou wiring.

# Impact (UI / logic / data)
- UI: o primeiro card expandido de `Context` agora apresenta os campos na ordem solicitada.
- Logic: sem mudança funcional.
- Data: sem mudança de payload ou persistência.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`

# Date
2026-03-01
