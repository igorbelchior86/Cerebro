# Title
Fix: Edit Org volta a mostrar sugestões iniciais sem digitar

# What changed
- Ajustado `GET /autotask/companies/search` para modo de busca vazia (`q=''`):
  - consulta orgs ativas
  - consulta orgs contendo `refresh`
  - faz merge deduplicado por `id` e aplica limite
- Mantido modo com texto (`q`) com política de retorno (`isActive OR refresh-exception`).

# Why it changed
- O modal `Edit Org` abria vazio e só listava orgs após digitação.
- Regressão causada por filtro vazio enviado ao Autotask.

# Impact (UI / logic / data)
- UI: sugestões iniciais voltam a aparecer no open do modal.
- Logic: estratégia explícita para busca vazia, sem depender de comportamento implícito do provider.
- Data: sem impacto estrutural.

# Files touched
- `apps/api/src/routes/autotask.ts`
- `tasks/lessons.md`

# Date
2026-02-27
