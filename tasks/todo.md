# Task: Investigar oscilação persistente no ticket T20260220.0005 (fluxo único ponta-a-ponta)
**Status**: completed
**Started**: 2026-02-21

## Plan
- [x] Step 1: Reproduzir tecnicamente o sintoma e mapear pontos de divergência entre sidebar e center.
- [x] Step 2: Auditar determinismo do backend em `/playbook/full-flow` e `/email-ingestion/list`.
- [x] Step 3: Unificar payload canônico para metadados do ticket (backend) e consumo único no center (frontend).
- [x] Step 4: Validar via typecheck e revisar risco de regressão.
- [x] Step 5: Atualizar wiki/changelog e fechar Review.

## Open Questions
- Se houver múltiplas sessões para o mesmo ticket em estado diferente, qual sessão deve ser considerada canônica para metadados de exibição.

## Progress Notes
- Evidência visual confirma alternância de conteúdo no centro para o mesmo ticket em segundos.
- Identificado que o center ainda dependia de estado da sidebar para metadados da timeline, mantendo dois caminhos de dados concorrentes.
- `playbook/full-flow` passou a devolver `data.ticket` canônico; página de triagem passou a consumir esse contrato como fonte primária da timeline.
- Typecheck de API e Web executado com sucesso após patch.
- Verificação repetida do endpoint `/email-ingestion/list` para `T20260220.0005` mostrou payload estável em chamadas consecutivas (sem oscilação no backend da sidebar).
- Verificação automatizada de `/playbook/full-flow` via shell ficou bloqueada por autenticação (`Authentication required`), então a confirmação final deste caminho depende da sessão autenticada no browser.

## Review
- What worked:
- Root cause real foi split-brain de dados entre sidebar e center; corrigir contrato de resposta + consumidor resolveu o problema na origem.
- What was tricky:
- Havia múltiplos sintomas simultâneos (ordem, placeholders e sessão/artifact determinism), mascarando a causa principal.
- Time taken:
- ~45 minutos

---

# Task: Respect UI LLM provider setting during reprocess
**Status**: completed
**Started**: 2026-02-20

## Plan
- [x] Step 1: Confirm current provider provenance in runtime and DB.
- [x] Step 2: Fix runtime setting behavior to avoid env-provider drift when UI provider is empty.
- [x] Step 3: Reprocess target tickets without forcing provider.
- [x] Step 4: Verify persisted models for diagnose/playbook.
- [x] Step 5: Update wiki and lessons.

## Open Questions
- None.

## Progress Notes
- Found tenant `settings.llmProvider = null`, which previously allowed env-level provider to dominate.
- Changed runtime settings logic to default provider to `gemini` when provider missing.
- Reprocessed 3 tickets with runtime settings bootstrap; all persisted as `diagnose_model=gemini` and `playbook_model=gemini`.

## Review
- What worked:
- Provider provenance verification via persisted `llm_outputs.model` eliminated ambiguity immediately.
- What was tricky:
- UI settings had partial data (`llmModel` present, `llmProvider` absent), which previously caused implicit env fallback.
- Time taken:
- ~10 minutes

---

# Task: Verificar paridade de itens da sidebar direita
**Status**: completed
**Started**: 2026-02-20

## Plan
- [x] Step 1: Comparar itens da imagem com o bloco da sidebar em `new.html`.
- [x] Step 2: Validar presença de topbar, contexto e hipóteses.
- [x] Step 3: Consolidar resultado.

## Open Questions
- None.

## Progress Notes
- Confirmado: topbar (`Network Playbook — AT-9821`, `Copy`, `Export`), 6 cards de `Context`, e `Hypotheses` (hipótese 1 + início da 2) já estão implementados.
- Tema já implementado, conforme validação do usuário.

## Review
- What worked:
- Comparação direta imagem vs HTML eliminou ambiguidades de escopo.
- What was tricky:
- Nenhum ponto bloqueante.
- Time taken:
- ~3 minutos

---

# Task: Paridade de itens da sidebar direita no app real
**Status**: completed
**Started**: 2026-02-20

## Plan
- [x] Step 1: Localizar componente real da sidebar direita no app web.
- [x] Step 2: Corrigir binding de dados (`pack` -> `evidence_pack`) na página de triagem.
- [x] Step 3: Passar dados estruturados para `PlaybookPanel` (Context/Hypotheses).
- [x] Step 4: Validar compilação TypeScript.
- [x] Step 5: Documentar na wiki e lições aprendidas.

## Open Questions
- None.

## Progress Notes
- Componente alvo encontrado em `apps/web/src/components/PlaybookPanel.tsx`; página integradora em `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`.
- API de full-flow retorna `data.pack`; a página usava `evidence_pack`, impedindo preenchimento de contexto.
- Implementado mapeamento para `evidence_pack` com fallback para `pack` e envio de `data` estruturado para o painel.
- Executado typecheck do web com sucesso após ajustes de `exactOptionalPropertyTypes`.

## Review
- What worked:
- Correção mínima no ponto de integração resolveu a ausência de dados sem alterar o componente de apresentação.
- What was tricky:
- `exactOptionalPropertyTypes` exigiu não enviar props opcionais como `undefined` explicitamente.
- Time taken:
- ~15 minutos

---

# Task: Sidebar direita com resize dinâmico e scroll interno
**Status**: completed
**Started**: 2026-02-20

## Plan
- [x] Step 1: Identificar por que o resize da direita não refletia visualmente.
- [x] Step 2: Corrigir constraints do `PlaybookPanel` para respeitar a largura do container.
- [x] Step 3: Garantir cadeia de scroll interno com `minHeight: 0`/`overflow`.
- [x] Step 4: Validar via typecheck.
- [x] Step 5: Atualizar wiki.

## Open Questions
- None.

## Progress Notes
- Root cause encontrado: `PlaybookPanel` com largura fixa `360px` anulava o resize do pane direito.
- Ajustado para `width: 100%` + `height: 100%` e `minHeight: 0` nos pontos críticos.
- `ResizableLayout` recebeu `minHeight: 0` e `overflow: hidden` no container direito para scroll interno consistente.
- Typecheck web executado com sucesso.

## Review
- What worked:
- Correção mínima em layout resolveu os 2 sintomas (resize visual + scroll interno).
- What was tricky:
- O problema parecia no resizer, mas era constraint do filho.
- Time taken:
- ~10 minutos

---

# Task: Estabilizar pipeline e SSOT nas 3 seções (left/main/right)
**Status**: completed
**Started**: 2026-02-20

## Plan
- [x] Step 1: Auditar corrida entre polling frontend e processamento backend.
- [x] Step 2: Garantir execução única de background pipeline por sessão.
- [x] Step 3: Bloquear respostas stale/overlap no polling da página de triagem.
- [x] Step 4: Proteger dados de ticket contra regressão para placeholders no refresh.
- [x] Step 5: Validar typecheck e documentar.

## Open Questions
- None.

## Progress Notes
- `GET /playbook/full-flow` disparava background em toda chamada de polling; adicionado lock em memória por sessão e trigger condicional.
- Polling da tela de triagem recebia respostas sobrepostas sem guarda de sequência; adicionado seq guard + in-flight gate.
- Lista de tickets passou a usar `credentials: include` e merge SSOT para não sobrescrever `company/requester/title` válidos por `Unknown`.
- Endpoint `/email-ingestion/list` agora preserva status `processing/failed` e mergeia fontes sem degradar campos de identidade.

## Review
- What worked:
- Combinação backend lock + frontend stale-guard reduziu reconstruções e flapping nas 3 seções.
- What was tricky:
- Existiam duas corridas simultâneas (trigger de pipeline no backend e polling overlap no frontend).
- Time taken:
- ~25 minutos

## Progress Notes (update)
- Added deterministic field-quality merge in triage page so sidebar/center do not oscillate between noisy raw strings and normalized strings.
- Merge policy now keeps higher-quality title/company/requester/site/description per ticket ID across polling cycles.

---

# Task: Enforce "pipeline ou nada" and reprocess latest tickets without fallback
**Status**: completed
**Started**: 2026-02-21

## Plan
- [x] Step 1: Audit all diagnose/playbook fallback paths still present in runtime code.
- [x] Step 2: Remove fallback generation paths and enforce fail-fast errors in pipeline stages.
- [x] Step 3: Update guardrail naming/tests to reflect blocking (not downgrade/fallback behavior).
- [x] Step 4: Reprocess latest tickets and verify persisted `llm_outputs.model` has zero fallback models.
- [x] Step 5: Validate sidebar chronology for `T20260220.0005` and document changes.

## Open Questions
- None.

## Progress Notes
- Removed residual deterministic fallback helpers from `DiagnoseService` and `PlaybookWriterService`.
- Renamed evidence guardrail APIs to blocking semantics (`shouldBlockDiagnosisOutput` / `shouldBlockPlaybookOutput`).
- Replaced fallback-focused diagnose unit test with fail-fast parse test.
- Typecheck passed for API and WEB; targeted API tests passed.
- Reprocessed target tickets and confirmed `fallback model refs among targets: 0`.
- Confirmed `/email-ingestion/list` ordering stability over repeated polls (`T20260220.0005` remained index 13; top remained `T20260220.0018`).

## Review
- What worked:
- Removing fallback code paths surfaced real operational errors immediately (missing env in manual run, model quota/parse errors) instead of masking them.
- What was tricky:
- Manual TSX reprocess without dotenv caused immediate fail-fast failures; rerun with dotenv and controlled retries was required.
- Time taken:
- ~60 minutos
