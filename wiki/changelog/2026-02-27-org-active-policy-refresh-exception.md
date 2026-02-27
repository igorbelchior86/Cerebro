# Title
2026-02-27: Exceção Refresh na política de Org ativa

# What changed
- A rota `GET /autotask/companies/search` passou a retornar org quando:
  - ativa, ou
  - nome contém `refresh`.

# Why it changed
- Manter política active-only e adicionar exceção de negócio para a org proprietária do software.

# Impact (UI / logic / data)
- UI: seleção de Org inclui `Refresh` mesmo fora da regra geral de ativo.
- Logic: filtro de retorno composto com exceção explícita.
- Data: sem impacto de schema.

# Files touched
- `apps/api/src/routes/autotask.ts`
- `tasks/lessons.md`

# Date
2026-02-27
