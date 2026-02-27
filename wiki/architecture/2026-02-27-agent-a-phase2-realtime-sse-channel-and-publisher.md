# Title
Architecture: SSE Realtime Channel + Workflow Publisher

# What changed
- Introduzido `WorkflowRealtimeHub` como barramento de eventos SSE por tenant.
- `TicketWorkflowCoreService` agora publica mudanças de estado via callback (`realtimePublisher`) sem acoplamento direto à rota.
- Rota `/workflow/realtime` atua como subscriber endpoint para frontend com handshake e heartbeat.

# Why it changed
- Preservar separação API/serviço de domínio: core publica eventos, hub distribui, rota expõe transporte.
- Suportar fallback polling sem alterar contratos existentes de inbox/audit/reconcile.

# Impact (UI / logic / data)
- UI: ganha canal push complementar ao polling.
- Logic: fluxo de comando/sync/reconcile passa a emitir sinais realtime com correlação.
- Data: estado de runtime permanece no mesmo repositório em memória/arquivo; sem alteração estrutural.

# Files touched
- `apps/api/src/services/workflow-realtime.ts`
- `apps/api/src/services/ticket-workflow-core.ts`
- `apps/api/src/services/workflow-runtime.ts`
- `apps/api/src/routes/workflow.ts`

# Date
2026-02-27
