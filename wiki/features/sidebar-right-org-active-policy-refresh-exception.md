# Title
Org picker: política active-only com exceção explícita para Refresh

# What changed
- Ajustado `GET /autotask/companies/search` para aplicar política de retorno:
  - inclui org ativa (`isActive=true`)
  - ou inclui org cujo nome contém `refresh` (case-insensitive)
- Mantida filtragem textual por `q`.

# Why it changed
- Necessidade de preservar regra de listar orgs ativas, sem bloquear a org do MSP proprietário (`Refresh`).

# Impact (UI / logic / data)
- UI: `Edit Org` mantém catálogo restrito, mas com exceção para `Refresh`.
- Logic: política composta (`active-only OR refresh-exception`).
- Data: sem migração/alteração estrutural.

# Files touched
- `apps/api/src/routes/autotask.ts`
- `tasks/lessons.md`

# Date
2026-02-27
