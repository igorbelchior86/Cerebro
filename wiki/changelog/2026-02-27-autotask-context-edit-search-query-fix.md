# Title
2026-02-27: Fix de erro 500 e vazio nos modais Edit Org/Edit Tech

# What changed
- Corrigida construção de `search` nos endpoints:
  - `GET /autotask/companies/search`
  - `GET /autotask/contacts/search`
  - `GET /autotask/resources/search`
- Endpoints agora enviam JSON estruturado com `MaxRecords` + `filter`.
- Removido caminho que passava string bruta e disparava fallback `title contains ...` no client.

# Why it changed
- `Edit Org` falhava com 500 (`Unable to find title in the Company Entity`) e `Edit Tech` ficava sem opções.
- O fallback do client para `title` não é válido para essas entidades.

# Impact (UI / logic / data)
- UI: seleção de Org/Tech operacional novamente.
- Logic: busca robusta com contrato correto do Autotask query API.
- Data: somente leitura; sem migração.

# Files touched
- `apps/api/src/routes/autotask.ts`
- `tasks/lessons.md`

# Date
2026-02-27
