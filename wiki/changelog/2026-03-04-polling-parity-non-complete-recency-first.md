# Polling parity non-complete recency-first
# What changed
- O `AutotaskPollingService` foi ajustado para hidratar tickets em ordem de recência real (mais recente -> mais antigo), com precedência por `lastActivityDate`, `createDateTime`, `createDate`.
- A coleta "recent" deixou de usar apenas 1h fixa e passou a usar janela configurável (`AUTOTASK_POLLER_RECENT_LOOKBACK_HOURS`, default 24h) e volume configurável (`AUTOTASK_POLLER_RECENT_MAX_RECORDS`, default 200).
- A fase de snapshot por fila agora usa estratégia de duas consultas por fila:
  - janela recente (`AUTOTASK_PARITY_RECENT_WINDOW_HOURS`, default 72h)
  - backlog da fila
  com merge/dedupe e ingestão ordenada por recência.
- Foi adicionado filtro de tickets terminais (Complete/Closed/Resolved/Done) por IDs de status (metadata Autotask) com fallback por label textual.
- O run loop passa a priorizar ingestão recente antes do snapshot de backlog, preservando parity de não-complete sem atrasar cobertura dos tickets do dia.

# Why it changed
- O fluxo anterior podia hidratar backlog histórico antes de completar a cobertura dos tickets recentes, causando cenários em que tickets antigos apareciam enquanto tickets novos ainda faltavam.

# Impact (UI / logic / data)
- UI: sidebar passa a convergir para lista mais recente primeiro com cobertura mais consistente dos tickets novos.
- Logic: pipeline de ingestão recency-first com filtro de não-complete e dedupe entre fases.
- Data: sem migração; ajuste de ordem e critério de ingestão no read model local.

# Files touched
- apps/api/src/services/adapters/autotask-polling.ts
- tasks/todo.md
- tasks/lessons.md

# Date
- 2026-03-04
