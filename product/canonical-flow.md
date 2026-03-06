eu preciso que você garante que esse é o ÚNICO Flow (fetch > intake > process > show)

# Plano Revisado Completo v5: Canonical JSON Pipeline com Consistência Forte, Segurança Operacional e UI por Blocos

## Resumo
Este plano consolida todos os ajustes e fecha os gaps de operação/segurança:
- PSA como SSOT externo; JSON canônico como SSOT interno do Cerebro.
- Captura integral de payload (100%) com raw+canonical.
- UI por blocos dependentes, com skeleton completo e estados explícitos.
- Processamento background-first desde intake.
- Retry/backoff/DLQ profissional com semântica clara na API/UI.
- Criptografia de mercado (envelope encryption), sem crypto custom.
- Gating objetivo para AI Replay.
- Scheduler com score composto determinístico + TTL do first_seen_boost.

---

## Objetivo
Maximizar corretude para troubleshooting com latência controlada:
- Dados corretos primeiro.
- Progresso visível sempre.
- Sem inconsistência silenciosa.
- Sem bloqueio indefinido de usuário.

---

## Escopo
- In: ingestão PSA, contrato canônico, persistência segura, fila/workers, read model por blocos, reconciliação, observabilidade, gates/evidências.
- Out: redesign visual completo fora dos blocos A/B/C; troca estrutural de stack de mensageria.

---

## Arquitetura e fluxo (fetch > intake > process > show)

## 1) Fetch (entrada PSA)
- Fontes: webhook/listener + polling de reconciliação.
- Metadados obrigatórios: `tenant_id`, `source`, `event_id|idempotency_key`, `occurred_at`, `received_at`, `trace_id`, `schema_version`.

## 2) Intake
- Persistir:
  - `raw_payload_encrypted` (100% do payload PSA).
  - `canonical_payload` (normalizado).
- Deduplicação idempotente por `(tenant_id, source, idempotency_key/event_id)`.
- Publicação na fila dedicada para projeção/enriquecimento.

## 3) Process (background-first)
- Inicia no intake (não depende de ticket ser aberto por técnico).
- Regras:
  - ordenação temporal,
  - ignorar out-of-order antigo,
  - merge canônico,
  - projeção do read model,
  - enriquecimento por bloco,
  - reconciliação periódica.
- Escrita degradada: comandos aceitos como `pending` em fila segura.

## 4) Show (UI)
- UI lê apenas read model canônico.
- Render por bloco com estado explícito e skeleton completo.

---

## Modelo de blocos UI (final)

## Bloco A — Core PSA
Campos:
- ticket number, subject, requester, org, status, created_at, issue/sub-issue, priority, SLA.
Regra:
- normalização mínima; libera cedo com consistência de tipos/campos.

## Bloco B — Network/Environment + Ticket Body
Campos:
- ticket body (html/plain canônico),
- inferências e confiabilidade de network/environment.
Regra:
- depende de processamento interno; validação de qualidade e parsing.

## Bloco C — Hypotheses/Checklist
Campos:
- hipóteses e checklist operacional.
Regra:
- depende de B concluído com confiança mínima.

Estados por bloco:
- `resolving | ready | degraded` (timeout por bloco: 10s).

---

## Scheduler de prioridade (com tie-break e TTL)

## Score composto
`priority_score = w1*recency + w2*sla_risk + w3*business_priority + w4*state_staleness + w5*first_seen_boost`

Pesos default:
- `w1=0.35`, `w2=0.30`, `w3=0.20`, `w4=0.10`, `w5=0.05`.

## Tie-break determinístico
1. Maior `priority_score`
2. Maior `sla_risk`
3. Menor `created_at`
4. `ticket_id` lexicográfico

## Expiração do first_seen_boost
- TTL: **15 minutos** desde `intake_received_at`.
- Regra:
  - `first_seen_boost=1` se `age<=15m`
  - `first_seen_boost=0` se `age>15m`

---

## Contratos públicos e tipos

## Novos/alterados tipos (packages/types)
- `CanonicalEventV1`
- `CanonicalTicketSnapshotV1`
- `BlockConsistencyStateV1`:
  - `core_state`
  - `network_env_body_state`
  - `hypothesis_checklist_state`
- `PipelineStatusV1`:
  - `queued | processing | retry_scheduled | degraded | dlq | ready`
- `ConnectorCommandStateV1`:
  - `accepted | pending | completed | failed | dlq`

## API de leitura
`GET /workflow/tickets/:id` retorna:
- snapshot canônico,
- estados por bloco,
- `pipeline_status`,
- `pipeline_reason_code`,
- `processing_lag_ms` (desde intake),
- `next_retry_at`,
- `retry_count`,
- `dlq_id`,
- `last_background_processed_at`,
- `consistent_at`,
- `trace_id`.

## API de operação
- `POST /workflow/tickets/:id/reconcile`
- `GET /workflow/tickets/:id/commands`

Compatibilidade:
- Contratos versionados (V1).
- Endpoints legados mantidos via feature flag até migração concluída.

---

## Retry/backoff/DLQ (professional-level)

## Política
- Exponential backoff + jitter.
- Classificação de erro:
  - `retryable_transient`
  - `retryable_rate_limit`
  - `non_retryable_validation`
  - `non_retryable_auth`
  - `non_retryable_schema`

## DLQ
- Contexto completo: tenant/ticket/trace/stage/reason.
- Reprocessamento controlado (manual + automatizado).
- Dashboard de aging, taxa e tendência.

## UI sem ambiguidade
- `retry_scheduled`: mostrar ETA (`next_retry_at`).
- `dlq`: bloco afetado em degradado + ação de reprocessar/escalar.
- `processing_lag_ms` nunca exibido sem `pipeline_status`.

---

## Segurança de dados e criptografia (sem reinventar)

## Decisão técnica
- Envelope encryption:
  - DEK: `AES-256-GCM`
  - KEK via KMS/provider.
- Não criar algoritmo/protocolo próprio.

## Persistência de segurança
- `encryption_meta` por registro:
  - `alg`, `key_ref`, `key_version`, `aad_hash`.
- AAD obrigatória: `tenant_id`, `ticket_id`, `event_id`, `schema_version`.
- Logs sem raw payload (somente metadados/hashes).

## Retenção
- 90 dias online (criptografado).
- Após 90 dias: arquivamento criptografado.

## Rotação KEK com falha parcial
- Job idempotente por lote com checkpoint.
- Estados de lote:
  - `pending | in_progress | partially_rotated | completed | failed`.
- Leitura multi-versão via `key_version` (compatível).
- Reconciliação de drift por versão.
- Alarmes:
  - `partially_rotated` > 15 min,
  - decrypt failures acima do threshold,
  - distribuição de versões fora do baseline.
- Bloqueio de purge de chave antiga até convergência.

---

## Observabilidade (gate ON)
- Logs estruturados com:
  - `tenant_id`, `correlation_id`, `trace_id`, `component`, `action`, `result`.
- Métricas:
  - ingestão, dedup, latência por bloco, degradado por bloco, retry/DLQ, drift de reconciliação, distribuição de key_version.
- Tracing:
  - propagação de contexto (`traceparent/tracestate`) em API/fila/workers.

---

## SLO/latência
Medidas desde `intake_received_at`:
- p95 Bloco A ready <= 2s
- p95 Bloco B ready <= 8s
- p95 Bloco C ready <= 15s
- Timeout de degradado por bloco: 10s
- Meta prewarm:
  - >=80% tickets com Bloco A pronto antes da primeira visualização.

---

## Gates de qualidade (todos ON com critério explícito)
1. Contract Gate:
- versão/compat + testes de contrato + migration path.
2. Tenant Isolation Gate:
- scoping explícito DB/cache/queue + testes negativos.
3. Connector Write-Safety Gate:
- idempotência + pending queue + retry/backoff + DLQ + testes.
4. AI Replay Gate (trigger matrix):
- ON quando mudar:
  - modelo/version,
  - prompt template,
  - schema B->C,
  - threshold/regras de inferência.
- OFF para mudanças sem impacto de inferência.
5. Observability Gate:
- logs/metrics/traces e correlação ponta a ponta.

---

## Testes e cenários obrigatórios

## Unit
- normalização canônica,
- dedup/idempotência,
- out-of-order,
- máquina de estado dos blocos,
- TTL do `first_seen_boost`.

## Contrato
- snapshots V1,
- compatibilidade backward.

## Integração
- scheduler score + tie-break determinístico,
- retry/backoff/DLQ e `pipeline_status`,
- escrita degradada `pending -> completed|dlq`,
- rotação parcial de KEK + recuperação.

## Segurança/isolamento
- negativos cross-tenant,
- masking/redaction de logs,
- AAD validation falhando corretamente.

## E2E UI
- skeleton completo,
- progressão A->B->C,
- retry_scheduled com ETA,
- DLQ com ação operacional.

## AI Replay
- suíte full para triggers ON,
- suíte smoke para re-enqueue manual.

---

## Rollout e rollback
1. Shadow mode com comparação legado vs canônico.
2. Canary por tenant.
3. Rollout progressivo por feature flags (ingest/process/show/commands).
4. Rollback:
- desativar flags novas,
- manter intake raw auditável,
- replay para recompor read model.

---

## Assumptions e defaults
- “Autotask/AT” tratado como PSA genérico.
- Bloco B inclui Ticket Body por definição.
- Processamento é background-first obrigatório.
- Sem fallback de payload bruto direto na UI de troubleshooting.
- Retenção e criptografia conforme decisão acima.

---

## Terminologia (usuário -> técnico)
- “JSON canônico” -> contrato versionado + raw encrypted store + read model.
- “dados corretos primeiro” -> gate de consistência por bloco.
- “menos ansiedade” -> skeleton + estados explícitos + ETA/retry/degraded claros.
- “profissional-level structure” -> idempotência, backoff+jitter, DLQ operável, observabilidade e gates com evidência.
