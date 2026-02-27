# Title
Sidebar right Org/User com write-through em Autotask + persistência SSOT

# What changed
- Implementado endpoint de escrita `PATCH /autotask/ticket/:ticketId/context`.
- O endpoint atualiza `companyID/contactID` no ticket do Autotask.
- Após write no Autotask, o endpoint sincroniza `ticket_ssot` (payload + `autotask_authoritative`) para persistir no Cerebro.
- O modal de edição `Org/User` no frontend passou a chamar esse endpoint ao selecionar opção, com estado de `saving` e mensagem de erro.

# Why it changed
- A versão anterior alterava apenas estado local da UI; ao atualizar a página, os dados voltavam ao valor anterior.
- Requisito validado pelo usuário: seleção de Org/User precisa refletir no Autotask e persistir no Cerebro.

# Impact (UI / logic / data)
- UI: seleção de Org/User agora executa persistência real e mantém valor após refresh.
- Logic: fluxo de edição virou write-through (Autotask -> SSOT).
- Data: atualização de `ticket_ssot.payload.autotask_authoritative` e campos canônicos derivados.

# Files touched
- `apps/api/src/routes/autotask.ts`
- `apps/web/src/lib/p0-ui-client.ts`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/lessons.md`

# Date
2026-02-27
