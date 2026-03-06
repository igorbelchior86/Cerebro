# Title
Bug Hunt: lint recovery no web e isolamento do teste do poller

# What changed
- Removido código morto e imports/props não usados em componentes do `apps/web` que estavam quebrando o `eslint`.
- Ajustado `apps/api/src/__tests__/services/autotask-polling.test.ts` para desabilitar o catch-up de backlog por padrão durante os testes e reabilitá-lo somente no caso que valida esse comportamento.
- Mantida a cobertura do catch-up com teste dedicado, sem contaminar os demais cenários do poller.

# Why it changed
- O frontend estava falhando no gate de qualidade por erros objetivos de lint, o que interrompia a validação normal do repositório.
- A suíte do poller executava um caminho extra de catch-up não necessário na maior parte dos testes, acionando consulta com `tenant-1` inválido no runtime de workflow e deixando um teste de latência instável.

# Impact (UI / logic / data)
- UI: nenhum comportamento funcional alterado; apenas remoção de código não usado.
- Logic: nenhum fluxo de produção alterado; o isolamento foi aplicado no arquivo de teste do poller.
- Data: nenhum impacto em banco, contratos públicos ou integrações.

# Files touched
- `apps/api/src/__tests__/services/autotask-polling.test.ts`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `apps/web/src/features/chat/playbook/PlaybookChecklist.tsx`
- `apps/web/src/features/chat/playbook/PlaybookContext.tsx`
- `apps/web/src/features/chat/playbook/PlaybookEscalate.tsx`
- `apps/web/src/features/chat/playbook/PlaybookHypotheses.tsx`
- `apps/web/src/features/chat/sidebar/SidebarControls.tsx`
- `apps/web/src/features/chat/sidebar/SidebarHeader.tsx`
- `apps/web/src/features/chat/sidebar/SidebarSearchModal.tsx`

# Date
2026-03-05
