# Title
Fix: listagem de User por Org usa filtro canônico companyID

# What changed
- Ajustado endpoint `GET /autotask/contacts/search` para não depender de `isActive` como filtro base.
- O filtro principal passou a ser `companyID` (quando informado), mantendo pós-filtro textual por nome/email.

# Why it changed
- Ao selecionar a org `Refresh Technologies`, a lista de usuários ficava vazia apesar da org estar selecionada.
- O filtro adicional de ativo no Contacts era restritivo/inconsistente para esse cenário.

# Impact (UI / logic / data)
- UI: `Edit User` volta a listar contatos da org selecionada.
- Logic: vínculo `User -> Org` usa chave canônica de associação (`companyID`).
- Data: sem impacto de schema/migração.

# Files touched
- `apps/api/src/routes/autotask.ts`
- `tasks/lessons.md`

# Date
2026-02-27
