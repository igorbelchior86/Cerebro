# Title
2026-02-27: Fix de erro 500 na troca de Org (companyLocationID)

# What changed
- Corrigido endpoint de contexto de ticket para limpar dependências ao trocar empresa:
  - `companyLocationID = null`
  - `contactID = null` quando não houver novo contato
- Mantido suporte a update de `contactID` no mesmo patch quando selecionado usuário.

# Why it changed
- O Autotask rejeitava update de company por incompatibilidade de `companyLocationID` legado.

# Impact (UI / logic / data)
- UI: modal `Edit Org` deixa de quebrar por esse erro de validação.
- Logic: write path ficou resiliente a estado legado do ticket.
- Data: sem migração; correção no payload de update.

# Files touched
- `apps/api/src/routes/autotask.ts`
- `tasks/lessons.md`

# Date
2026-02-27
