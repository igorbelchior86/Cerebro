# Task: Comparar Autotask vs payload da sidebar para queues ausentes

**Status**: completed
**Started**: 2026-02-25

## Plan
- [x] Step 1: Coletar amostra de tickets recentes no Autotask (id, queueID, ticketNumber, updated timestamp)
- [x] Step 2: Comparar com `ticket_ssot` / payload da sidebar para medir cobertura de `queue_id/queue_name`
- [x] Step 3: Identificar root cause (ingestão, SSOT, hidratação on-demand, recorte da lista, cache)
- [x] Step 4: Aplicar correção mínima (lookup por `ticketNumber`), verificar, e atualizar wiki

## Open Questions
- A diferença remanescente entre Autotask e sidebar é de cobertura de ingestão (tickets fora de `tickets_processed/triage_sessions/SSOT`), não de metadata de queue.

## Progress Notes
- Investigação solicitada: existem tickets visíveis no Autotask (incluindo alguns de hoje) que não aparecem em nenhuma queue no Cerebro.
- Objetivo desta etapa: comparar dados reais Autotask vs payload/SSOT e validar se estamos no caminho certo antes de mexer mais na UI.
- Evidência inicial do bug de queue: tickets com `ticket_id` `T20260225.0013` etc. falhavam em `getTicket(id)` (404), mas eram resolvidos por `getTicketByTicketNumber(...)` com `queueID` válido.
- Correção aplicada em `hydrateAutotaskQueueMetadataForSidebar`: aceitar `ticketNumber` T-format e usar lookup por `ticketNumber` (com fallback para numéricos que não são `id` interno).
- Verificação após correção: `/email-ingestion/list` passou de `missingQueue=146` para `missingQueue=0` após hidratação aquecer cache/lookup.
- Comparação Autotask (hoje) vs sidebar: `32` tickets no Autotask com prefixo `T20260225.`, `11` presentes na sidebar e `21` ausentes.
- Amostra dos `21` ausentes confirmou `in_processed=false`, `in_sessions=false`, `has_ssot=false`; ou seja, não é bug de filtro/queue, é ticket ainda não importado para o pipeline que alimenta a sidebar.

## Review
- What worked: comparação direta Autotask + payload + DB isolou rapidamente o bug real (lookup por `ticketNumber`) e separou isso da lacuna de ingestão.
- What was tricky: sintomas iguais (“queue vazia”) vinham de causas diferentes: bug de hidratação e ausência do ticket no pipeline.
- Time taken:
