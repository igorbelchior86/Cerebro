# Title
Phase 2 Realtime Inbox/Ticket Updates (Agent A)

# What changed
- Implementado canal realtime SSE para mudanças de estado de inbox/ticket em `/workflow/realtime`.
- Publicação de eventos tipados para `assign/status/comment/process_result/sync` no fluxo de workflow.
- Frontend passou a consumir realtime no hook de polling com fallback automático para polling quando realtime degrada.
- Sinal explícito de degradado adicionado no estado do hook e exibido no P0 Inbox.

# Why it changed
- Reduzir latência percebida entre mudanças de ticket e atualização de tela.
- Permitir fallback seguro para polling sem quebrar UX quando realtime falhar.

# Impact (UI / logic / data)
- UI: atualização de inbox sem refresh manual quando SSE está saudável; badge de estado realtime/degraded no P0 Inbox.
- Logic: novo fluxo publish/subscribe tenant-scoped com heartbeat e reconnect.
- Data: sem migração de schema; apenas transporte adicional de eventos em memória.

# Files touched
- `apps/api/src/services/workflow-realtime.ts`
- `apps/api/src/services/workflow-runtime.ts`
- `apps/api/src/services/ticket-workflow-core.ts`
- `apps/api/src/routes/workflow.ts`
- `apps/api/src/__tests__/services/workflow-realtime.test.ts`
- `apps/api/src/__tests__/services/ticket-workflow-core.test.ts`
- `apps/web/src/hooks/usePollingResource.ts`
- `apps/web/src/components/p0/P0InboxPage.tsx`
- `apps/web/src/components/p0/P0ManagerOpsPage.tsx`
- `apps/web/src/components/p0/P0WorkflowTicketPage.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `packages/types/src/workflow-realtime.ts`
- `packages/types/src/index.ts`

# Date
2026-02-27
