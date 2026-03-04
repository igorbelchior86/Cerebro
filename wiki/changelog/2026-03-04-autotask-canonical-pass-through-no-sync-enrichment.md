# Autotask canonical pass-through sem enrichment tardio
# What changed
- Removido o enrichment de sync por `fetchTicketSnapshot` dentro de `processAutotaskSyncEvent` para campos canônicos da sidebar/contexto.
- `normalizeEventDomainSnapshots` passou a persistir diretamente `company_id`, `contact_id`, `company_name`, `contact_name`, `contact_email`, `created_at`, `priority`, `issue_type`, `sub_issue_type`, `sla` e labels associados quando disponíveis no payload.
- Removido o sweep `backfillCanonicalIdentity` do poller `adapters/autotask-polling` para evitar reescrita tardia do read model.
- Frontend de triagem passou a priorizar os campos canônicos vindos de `/workflow/inbox` para Priority/Issue/Sub-Issue/SLA e IDs de Org/Contact no render principal.
- Removido prefetch de `/autotask/ticket-field-options` usado apenas para preencher labels em background no render passivo.
- Atualizado teste de contrato do workflow core para validar pass-through canônico sem chamada a `fetchTicketSnapshot` no sync.

# Why it changed
- O fluxo antigo ainda fazia hidratação/enrichment após ingestão, causando oscilação de valores e shimmer prolongado.
- Com acesso completo ao Autotask, os campos já chegam prontos e devem ser replicados diretamente no read model consumido pela UI.

# Impact (UI / logic / data)
- UI: cards/contexto deixam de depender de resolução tardia de labels para campos canônicos; render usa snapshot canônico vindo do inbox.
- Logic: `processAutotaskSyncEvent` vira pass-through determinístico para os campos canônicos; poller não executa mais varredura de backfill pós-ingestão.
- Data: `domain_snapshots.tickets` e `correlates.ticket_metadata` passam a carregar IDs/labels canônicos de forma consistente desde a ingestão.

# Files touched
- apps/api/src/services/orchestration/ticket-workflow-core.ts
- apps/api/src/services/adapters/autotask-polling.ts
- apps/api/src/__tests__/services/ticket-workflow-core.test.ts
- apps/web/src/features/chat/sidebar/types.ts
- apps/web/src/lib/workflow-sidebar-adapter.ts
- apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx

# Date
- 2026-03-04
