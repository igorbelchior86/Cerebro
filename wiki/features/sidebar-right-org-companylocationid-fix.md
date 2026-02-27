# Title
Fix: troca de Org limpa dependências inválidas de location/contact no ticket Autotask

# What changed
- Ajustado `PATCH /autotask/ticket/:ticketId/context` para, ao trocar `companyID`:
  - limpar `companyLocationID` (`null`)
  - limpar `contactID` quando nenhum contato novo é enviado
- Mantido update de `contactID` quando informado explicitamente no payload.

# Why it changed
- O Autotask retornava 500 ao trocar Org com erro de associação de `companyLocationID` com a nova empresa.
- O ticket carregava location/contact herdados da empresa anterior, invalidando o patch.

# Impact (UI / logic / data)
- UI: salvar Org deixa de falhar nesse cenário.
- Logic: patch de contexto garante consistência entre empresa e dependências associadas.
- Data: ticket no Autotask passa por saneamento de referências ao trocar empresa.

# Files touched
- `apps/api/src/routes/autotask.ts`
- `tasks/lessons.md`

# Date
2026-02-27
