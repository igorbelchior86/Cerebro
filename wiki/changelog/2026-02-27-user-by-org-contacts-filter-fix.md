# Title
2026-02-27: Fix de User vazio após seleção de Org

# What changed
- Corrigida rota `GET /autotask/contacts/search` para usar `companyID` como filtro base.
- Removido gate de `isActive` na query base de Contacts.
- Mantida filtragem textual de busca (`q`) no pós-processamento backend.

# Why it changed
- Usuário reportou que, após selecionar a org `Refresh Technologies`, a lista de `User` não carregava.

# Impact (UI / logic / data)
- UI: modal `Edit User` passa a exibir contatos da org selecionada.
- Logic: menor risco de falso-vazio por variação de schema no Contacts.
- Data: sem alterações estruturais.

# Files touched
- `apps/api/src/routes/autotask.ts`
- `tasks/lessons.md`

# Date
2026-02-27
