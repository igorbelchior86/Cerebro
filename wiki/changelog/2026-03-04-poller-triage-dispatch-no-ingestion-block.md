# Poller triage dispatch no ingestion block
# What changed
- O loop principal do `AutotaskPollingService` deixou de bloquear ingestão de tickets enquanto executava o pipeline de triage ticket-a-ticket.
- A ingestão (`ticket.created` -> workflow inbox) agora é concluída para todo o lote recente antes do dispatch de triage.
- O dispatch de triage passou a usar concorrência configurável (`AUTOTASK_POLLER_TRIAGE_CONCURRENCY`, default 3).

# Why it changed
- A execução sequencial de triage no mesmo loop diminuía throughput da ingestão e podia atrasar a aparição de tickets recentes na sidebar, mesmo com polling ativo.

# Impact (UI / logic / data)
- UI: tickets recentes aparecem mais rápido e em lote, sem depender do tempo total de triage.
- Logic: separação entre etapa de ingestão canônica e etapa de orquestração de triage.
- Data: sem migração; apenas mudança de ordem de processamento no runtime.

# Files touched
- apps/api/src/services/adapters/autotask-polling.ts
- tasks/todo.md

# Date
- 2026-03-04
