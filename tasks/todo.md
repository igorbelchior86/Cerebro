# Task: Corrigir contrato dos Passos 1-2 (Despertar + Prepare Context)
**Status**: verifying
**Started**: 2026-02-23

## Plan
- [x] Research Gate: Inventariar IT Glue (oficial) + NinjaOne (fontes públicas alternativas) e mapear gaps antes de finalizar 2c
- [x] Step 1: Congelar especificação funcional correta do Passo 2 (2a..2f) em termos técnicos/artefatos
- [x] Step 2: Mapear implementação atual vs contrato (normalização ticket, snapshots ITG/Ninja, extração heurística, cruzamento LLM, histórico, segunda passada)
- [x] Step 3: Implementar 2a (normalização dupla do texto do ticket/email) com testes
- [ ] Step 4: Implementar/ajustar 2b-2d (snapshots completos + extrações + cruzamento final SSOT) com testes
- [ ] Step 5: Implementar/ajustar 2e-2f (histórico amplo + última passada ITG/Ninja) com testes
- [ ] Step 6: Validar fluxo end-to-end de Passos 1-2 e documentar na wiki

## Open Questions
- Estrutura exata desejada de schema em `itglue_org_enriched` para separar campos por fonte vs SSOT final (se já existir, reutilizar)
- Se a “reinterpretação para UI” deve ser persistida no SSOT ou apenas em artifact derivado para frontend

## Progress Notes
- 2d (cross-source fusion) implementado: candidatos determinísticos + links/inferences + adjudicação LLM estruturada + aplicação pós-validação em round 7 antes do SSOT.
- `ticket_ssot` agora pode carregar `fusion_audit` opcional (audit trail de evidências/inferências aplicadas).
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK após 2d.
- 2c (Ninja) entregue no padrão 2b: `ninja_org_snapshot` + `ninja_org_enriched` + refresh cleanup best-effort.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK após 2c.
- Inventário criado em `wiki/architecture/2026-02-23-ninjaone-itglue-capture-inventory-for-step2b-2c.md` (IT Glue oficial confirmado; NinjaOne parcial via Postman/apidocs públicos + gaps).
- Regra ajustada: não finalizar 2c sem catálogo NinjaOne completo (preferência: export da coleção Postman).
- 2b (IT Glue raw snapshot) ampliado: `documents_raw`, attachments, related items e flexible assets multi-tipo com tolerância a falha parcial.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK após mudança.
- Usuário corrigiu o contrato funcional do Prepare Context com definição explícita de 2a..2f.

## Progress Notes
- 2d (cross-source fusion) implementado: candidatos determinísticos + links/inferences + adjudicação LLM estruturada + aplicação pós-validação em round 7 antes do SSOT.
- `ticket_ssot` agora pode carregar `fusion_audit` opcional (audit trail de evidências/inferências aplicadas).
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK após 2d.
- 2c (Ninja) entregue no padrão 2b: `ninja_org_snapshot` + `ninja_org_enriched` + refresh cleanup best-effort.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK após 2c.
- Inventário criado em `wiki/architecture/2026-02-23-ninjaone-itglue-capture-inventory-for-step2b-2c.md` (IT Glue oficial confirmado; NinjaOne parcial via Postman/apidocs públicos + gaps).
- Regra ajustada: não finalizar 2c sem catálogo NinjaOne completo (preferência: export da coleção Postman).
- 2b (IT Glue raw snapshot) ampliado: `documents_raw`, attachments, related items e flexible assets multi-tipo com tolerância a falha parcial.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK após mudança.
- 2a entregue: artefato separado `ticket_text_artifacts` + `data.ticket_text_artifact` no full-flow + toggle Reframed/Original no evento Autotask.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` e `pnpm --filter @playbook-brain/web typecheck` OK.
- 2e (histórico amplo) implementado como segunda correlação pós-fusão (round 8): termos ponderados vindos de SSOT/fusion/ticket/docs + scoring local sobre casos aprovados (Autotask/email fallback).
- `related_cases` final e `evidence_digest` agora são recompostos após a busca ampla de histórico; `iterative_enrichment.rounds` passa a refletir `history_correlation_broad`.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK após 2e.
- Extensão do 2e aprovada e implementada: histórico agora também calibra confiança dos campos do enrichment/SSOT (boost/decrease/context-only) e registra contradictions de ISP em appendix separado.
- Novo artefato `ticket_context_appendix` persistido por ticket (history correlation + history confidence calibration + fusion summary) e exposto no `/playbook/full-flow`.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK após artifact appendix + calibration.
- 2f implementado: passada final IT Glue + Ninja guiada por gaps/conflicts/history appendix (`round 9`) com backfill conservador de campos no enrichment e recalculo de evidence/coverage/rounds.
- `ticket_context_appendix.final_refinement` agora registra targets, termos, docs adicionados, sinais Ninja adicionados e campos atualizados.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK após 2f.
- 2.5 (novo) implementado: UI de triagem passa a priorizar `SSOT` + `ticket_context_appendix` para header/meta/timeline/context cards (com fallback em `evidence_pack` somente quando necessário).
- `PlaybookPanel` contexto agora mostra infraestrutura do SSOT (firewall/wifi/switch/device) e metadados de pipeline via appendix (history matches + final refinement fields).
- Verificação: `pnpm --filter @playbook-brain/web typecheck` OK após 2.5.
- Refresh pipeline (`/playbook/full-flow?refresh=1`) agora reinicia de verdade no Passo 1: limpa artefatos, marca sessão atual como reiniciada (`failed/manual refresh restart`) e cria uma **nova** `triage_session` pendente para o mesmo ticket.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK após mudança de refresh restart.
- Correção pós-validação do usuário: refresh ainda podia mostrar dados antigos por race de sessão antiga + cache local de UI.
- Fix aplicado: guardas de persistência para artefatos por ticket (`ticket_ssot`, `ticket_text_artifact`, `ticket_context_appendix`) rejeitam sessões superseded; frontend invalida `ticketSnapshotRef`, pausa polling durante refresh e descarta respostas em voo.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` e `pnpm --filter @playbook-brain/web typecheck` OK após fix de race/cache no refresh.
- Hotfix 2a aplicado: `text_clean` agora passa por pós-processamento determinístico agressivo (anti-HTML/portal boilerplate/assinatura/disclaimer/safelinks) mesmo quando a LLM deixa ruído passar.
- Hotfix UI aplicado: linha “New ticket detected ... at org, site” evita redundância quando `site == requester` ou `site == org`.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` e `pnpm --filter @playbook-brain/web typecheck` OK após hotfix de normalização/UI.
- Fix de troubleshooting 2a (UI): evento Autotask na center column agora expõe `text_clean` no toggle premium (`Reframed / Clean / Original`), usando `ticket_text_artifact.text_clean`.
- Verificação: `pnpm --filter @playbook-brain/web typecheck` OK após ajuste de passagem `text_clean` + assinatura da timeline.
- Fix de troubleshooting 2a (semântica): reinterpretação do ticket agora aplica guard determinístico de papéis (requester vs affected user) para evitar atribuir o nome do requester ao "new employee".
- Prompt de normalização LLM reforçado com regra explícita: não confundir requester e affected user; manter affected unnamed quando não houver nome explícito.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK após guard de role assignment no `description_ui`.
- Fix de troubleshooting 2 (scope): extração de `company` endurecida a partir do corpo HTML/email (ex.: “created for CAT Resources, LLC”) antes do fallback por domínio.
- Fix de troubleshooting 2e (histórico): broad history agora exige escopo confiável (`orgId` ou `companyName`) e filtra por `tickets_processed.company` quando org não está resolvida, evitando related cases cross-company.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK após hardening de company + history scope.
- Fix arquitetural (anti-regressão intake -> SSOT): `ticket_ssot` agora aplica merge protetivo pós-builder para impedir downgrade de campos conhecidos do intake (`company`, requester, title, description, created_at, emails) para `unknown`.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK após anti-regressão no SSOT.
- Fix residual de empresa: inferência de `company` agora também usa o `originalTicketNarrative` (pré-normalização), preservando pistas removidas do `rawBody` limpo (ex.: “created for CAT Resources, LLC”).
- Fix residual de history carryover: no round 8, `relatedCases` é reatribuído sempre (inclusive vazio) e não herda resultados antigos quando o broad history é bloqueado por falta de escopo.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK após fixes residuais de company/history.
- Melhoria genérica de modelagem (IT Glue extractor): adicionado slice determinístico para extrair candidatos de WAN/ISP (assets/configs/docs), infra via metadata de passwords/configs/assets (firewall/wifi/switch) e ranking genérico de docs por intenção do ticket.
- Hardening de matching de org: `fuzzyMatch` agora normaliza pontuação/sufixos legais (`LLC`, `Inc`, etc.) e usa overlap de tokens, melhorando resolução de orgs (IT Glue/Ninja) sem hardcode por cliente.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK após extractor genérico + org matching.
- Troubleshooting de validação em `T20260223.0006` revelou falso positivo de org IT Glue: `CAT Resources, LLC` estava caindo em `Composite Resources, Inc.`, gerando `passwords/docs/assets = 0` e impedindo enrich real de rede/infra.
- Fix genérico aplicado no resolver de org IT Glue/Ninja: ranking por score (em vez de `find()` booleano), penalidade para overlap só em tokens genéricos (`resources`, `solutions`, etc.), e `getOrganizations(1000)` para respeitar inventário amplo do tenant.
- Hardening adicional no fallback por domínio (IT Glue): filtra domínios de serviço/boilerplate (`outlook`, `autotask`, `itclientportal`, `refreshtech`) antes de resolver org por `primary_domain`.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK após fix de ranking/page-size/fallback de org.
- Bug runtime descoberto na validação: broad history usava `tickets_processed.company` (coluna inexistente), causando erro `42703` em `findRelatedCasesBroad`.
- Fix aplicado: filtro por empresa do histórico agora usa `ticket_ssot.payload->>'company'` via `LEFT JOIN ticket_ssot`, mantendo scope por SSOT e evitando quebra do round 8.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK após fix de query de histórico por empresa.
- Root cause confirmado por probe direto no IT Glue: empresa/match estavam corretos, mas dados relevantes estavam distribuídos entre org parent (`Composite`) e child (`CAT Resources`); além disso `/documents` global retornava 404 para o tenant e parte da extração lia attrs ITG em `snake_case` enquanto a API devolve `kebab-case`.
- Fix aplicado: coleta IT Glue round 2 agora suporta `family scopes` (matched + parent/ancestors + children relevantes), `documents/passwords` com fallback nested-first no `ITGlueClient`, agregação multi-scope com `collection_errors`, e helper genérico `itgAttr(...)` para ler attrs ITG em kebab/snake/camel (+ traits).
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK após hardening multi-org + normalização de attrs ITG.
- Guardrail de cota IT Glue adicionado no round 2: request budget explícito por ticket (`ITGLUE_ROUND2_REQUEST_BUDGET`), limite de org scopes, limite/ranking de `flexible_asset_types` por ticket e limite de expansão de docs (attachments/related items) conforme budget restante.
- `source_findings` round 2 agora expõe consumo de budget e quantos tipos de flexible assets foram selecionados por scope, facilitando troubleshooting de quota.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK após guardrails de quota IT Glue.
- Bug crítico de vazamento no SSOT identificado em `T20260223.0006`: `runCrossSourceFusion` aceitou inferência LLM inventada (`internal_hr_system`) e sobrescreveu `ticket.affected_user_name` para `Alex Hall` sem evidência suportada.
- Fix aplicado: resoluções LLM do fusion agora passam por validação determinística (evidence_refs/inference_refs devem existir nos candidatos/links/inferences gerados pelo pipeline; campos de identidade não aceitam valores fora dos candidatos sem inferência determinística válida). Links/inferences vindos da LLM deixaram de ser aceitos; apenas os determinísticos do pipeline entram no audit/merge.
- Unificação UI/SSOT aplicada: sidebar (`/email-ingestion/list`) e center/right usam a mesma regra de exibição derivada do SSOT para "User" (affected user só quando específico; senão requester), eliminando split-brain `requester vs affected` semântica.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` e `pnpm --filter @playbook-brain/web typecheck` OK após fix de fusion+UI.
- Root cause de falha consistente em `T20260221.0001` identificado no `PlaybookWriter`: falso positivo no contamination guard bloqueando termos técnicos legítimos (`API response`, `debug logs`) por regex ampla demais.
- Fix aplicado no contamination guard: padrões internos foram estreitados para bloquear somente contexto meta de engine/modelo (`model/llm api response`, `debug prompt/model/llm/json`) e permitir troubleshooting operacional.
- Testes de regressão adicionados/validados em `playbook-writer-contamination.test.ts` cobrindo ambos os lados (troubleshooting legítimo permitido + meta leakage ainda bloqueado).
- Verificação: `pnpm --filter @playbook-brain/api test -- playbook-writer-contamination` e `pnpm --filter @playbook-brain/api typecheck` OK após fix do PlaybookWriter contamination guard.
- Bug UI/SSOT corrigido: `company` mudava para variante degradada após processamento (ex.: nome colapsado sem pontuação) porque o SSOT aceitava versão processada significativa; anti-regressão do `PrepareContext` agora preserva o `ticket.company` bruto do intake como fonte canônica de display.
- UI simplificada: removido campo `Site` da coluna direita (PlaybookPanel context cards) para eliminar vazamento de formatação e reduzir ruído até termos extração confiável.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` e `pnpm --filter @playbook-brain/web typecheck` OK após fix de company SSOT + remoção do campo Site.
- Root cause adicional do nome de empresa errado em `T20260221.0001`: inferência de `company` no `PrepareContext` lia HTML cru sem decodificar entidades (`&amp;`), falhava em capturar “GARMON & CO. INC.” na frase “created for ...” e caía no fallback por domínio (`Garmonandcompany`).
- Fix aplicado: `inferCompanyNameFromTicketText(...)` agora decodifica entidades HTML básicas antes dos regex de extração de empresa.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK após fix de decodificação HTML na inferência de company.
- Bug de observabilidade no `/playbook/full-flow` identificado: background processing marcava `triage_sessions.status = failed|pending` sem persistir `last_error`, deixando tickets em `FAILED` sem motivo visível após refresh.
- Fix aplicado: background catch do `triggerBackgroundProcessing()` agora persiste `last_error` com a mensagem real da exceção.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK após fix de persistência de `last_error` no full-flow background.
- Root cause atual do `FAILED` em `T20260221.0001` identificado: não era mais contamination guard; o `evidence` playbook guardrail estava bloqueando por "unsupported inference" em ticket de WiFi (falso positivo de high-risk drift).
- Fix aplicado no `shouldBlockPlaybookOutput`: bloqueio de termos high-risk sem evidência agora exige deriva assertiva (root-cause/compromise) ou ação de remediação de incidente; menções incidentais/defensivas deixam de bloquear o playbook.
- Melhoria de observabilidade: `PlaybookWriter` agora inclui razão do bloqueio (`unsupported_high_risk_inference` / `unsupported_integration_remediation`) no erro quando o guardrail dispara.
- Testes adicionados para cobrir high-risk incidental vs. deriva assertiva em `evidence-guardrails.test.ts`.
- Verificação: `pnpm --filter @playbook-brain/api test -- evidence-guardrails`, `pnpm --filter @playbook-brain/api test -- playbook-writer-contamination`, `pnpm --filter @playbook-brain/api typecheck` OK após fix do playbook evidence guardrail.

## Review
(fill in after completion)
- What worked:
- What was tricky:
- Time taken:

---

# Task: Phase 3 Diagnose Strengthening (Technical Plan)
**Status**: planning
**Started**: 2026-02-24

## Plan
- [ ] Step 1: Define Diagnose quality targets (grounding, relevance, confidence calibration, abstention)
- [ ] Step 2: Design hybrid Diagnose architecture (LLM generation + deterministic scoring/calibration)
- [ ] Step 3: Specify output/schema changes with backward compatibility for Validate/Playbook/UI
- [ ] Step 4: Define incremental rollout + verification protocol on real tickets

## Open Questions
- Should calibrated confidence replace current confidence immediately, or ship in parallel (`confidence_calibrated`) first?
- Do we want hypothesis-level grounding only first, or claim-level grounding in v1?
- How much of the new scoring should be exposed in UI vs appendix only?

## Review
(fill in after completion)
- What worked:
- What was tricky:
- Time taken:

- Correção de escopo de rollout registrada: este app ainda está em desenvolvimento (sem produção), então o strengthen da Fase 3 foi implementado diretamente em vez de rollout paralelo.
- Fase 3 (`Diagnose`) strengthened implementada: pós-processamento determinístico de hipóteses com `support_score`, `relevance_score`, `grounding_status`, `calibrated_confidence` e `playbook_anchor_eligible`, mantendo compatibilidade do campo `confidence`.
- `DiagnoseService` agora recalibra e reranqueia hipóteses após parse da LLM usando evidências do `evidence_digest`, baseline algorítmico e penalidades de conflito/missing/irrelevância.
- Heurística de relevância adicionada para reduzir overreach cross-domain (ex.: hipótese de firewall em ticket de email/rename).
- Teste novo `diagnose-calibration.test.ts` cobre downgrade de overreach cross-domain.
- Verificação: `pnpm --filter @playbook-brain/api test -- diagnose-calibration`, `pnpm --filter @playbook-brain/api test -- diagnose-fail-fast`, `pnpm --filter @playbook-brain/api typecheck` OK.
## Task: Sidebar direita - substituir SLA por Phone Provider e reordenar cards (2026-02-24)
**Status**: completed
**Started**: 2026-02-24

## Plan
- [x] Step 1: Localizar o array de cards da sidebar direita no triage page
- [x] Step 2: Identificar campo disponível para `Phone Provider` no payload
- [x] Step 3: Implementar mudança mínima (remover `SLA`, inserir `Phone Provider`, manter ordem solicitada)
- [x] Step 4: Verificar build/typecheck local do web
- [x] Step 5: Documentar na wiki (feature + changelog) e preencher review

## Open Questions
- Nenhuma (campo backend `ssot.phone_provider_name` já existe; fallback para `Unknown`).

## Progress Notes
- `SLA` removido da grade de contexto da sidebar direita.
- `Phone Provider` inserido após `User device`, preservando a ordem: `User device | Phone Provider` e `History | Refinement`.
- Tipagem de `SessionData.ssot` expandida para incluir `phone_provider_name`.
- Verificação: `pnpm --filter @playbook-brain/web typecheck` OK.
- Wiki atualizada com feature e changelog da alteração.

## Review
- What worked: mudança localizada em um único array de cards; backend já expunha `phone_provider_name`.
- What was tricky: confirmar o campo correto no payload sem inventar schema novo.
- Time taken: ~10 min
## Task: Corrigir promoção de `phone_provider_name` para SSOT (2026-02-24)
**Status**: completed
**Started**: 2026-02-24

## Plan
- [x] Step 1: Confirmar root cause no `PrepareContext` (campo inferido existe no enrichment e não entra no SSOT)
- [x] Step 2: Corrigir `TicketSSOT` + `buildTicketSSOT(...)` para persistir `phone_provider_name`
- [x] Step 3: Validar `typecheck` de `api` e `web`
- [x] Step 4: Documentar correção na wiki

## Open Questions
- Nenhuma. O contrato é explícito: UI é SSOT-only; correção deve acontecer na promoção para `ticket_ssot`.

## Progress Notes
- Root cause confirmado: `network.phone_provider_name` era produzido no enrichment (`buildNetworkEnrichmentSection`) mas descartado em `buildTicketSSOT(...)`.
- Fix aplicado em `apps/api/src/services/prepare-context.ts`: `TicketSSOT` agora inclui `phone_provider_name` e o valor é persistido a partir de `network.phone_provider_name`.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK.
- Verificação: `pnpm --filter @playbook-brain/web typecheck` OK.

## Review
- What worked: correção mínima e centralizada no ponto de montagem do SSOT.
- What was tricky: não cair na tentação de corrigir na UI com fallback (violaria o contrato SSOT-only).
- Time taken: ~12 min

## Task: Sidebar - filtro de tickets suprimidos (noise inline toggle) (2026-02-24)
**Status**: completed
**Started**: 2026-02-24

## Plan
- [x] Step 1: Confirmar ponto de integração da sidebar e payload da lista (`/email-ingestion/list`)
- [x] Step 2: Adicionar metadados de supressão determinísticos (somente ruído óbvio) ao endpoint da lista
- [x] Step 3: Implementar toggle de filtro na `ChatSidebar` (default ON) para ocultar/exibir suprimidos inline
- [x] Step 4: Diferenciar visualmente itens suprimidos quando filtro estiver OFF (badge + motivo)
- [x] Step 5: Validar `typecheck` (`api` + `web`) e revisar diffs
- [x] Step 6: Documentar na wiki (feature + changelog) e preencher review

## Open Questions
- Resolvido: persistência do toggle em `localStorage` (`chatSidebarHideSuppressed.v1`), sem alterar URL.
- Resolvido: heurística v1 de supressão aplicada no endpoint `/email-ingestion/list` como metadado transitório (sem persistência em banco/pipeline).

## Progress Notes
- Usuário aprovou UX: botão de filtro na área das tabs; inicia ligado; desligado mostra suprimidos inline.
- Princípio de segurança alinhado: `Suppress` > `Delete`.
- `apps/api/src/routes/email-ingestion.ts` agora retorna `suppressed`, `suppression_reason`, `suppression_reason_label` e `suppression_confidence` usando heurísticas conservadoras para `bounce`, `quarantine digest` e `marketing`.
- `apps/web/src/components/ChatSidebar.tsx` ganhou toggle de visibilidade de suprimidos (default ON), badge de contagem no botão e render inline com chip `SUPPRESSED`.
- `apps/web/messages/en.json` atualizado com labels/tooltip do novo controle.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK.
- Verificação: `pnpm --filter @playbook-brain/web typecheck` OK.
- Wiki atualizada com feature + changelog da alteração.

## Review
- What worked: mudança incremental e reversível; backend e frontend ficaram compatíveis com `suppressed` opcional sem exigir migração de banco.
- What was tricky: manter heurística de supressão extremamente conservadora para evitar falso positivo e ainda demonstrar valor na UI imediatamente.
- Time taken: ~35 min

## Task: Refinar ícone do botão de refresh no header da triagem (2026-02-24)
**Status**: completed
**Started**: 2026-02-24

## Plan
- [x] Step 1: Localizar botão de refresh e identificar causa visual (ícone/proporção/estilo)
- [x] Step 2: Aplicar ajuste mínimo de UI (ícone + sizing + estados visuais)
- [x] Step 3: Validar `pnpm --filter @playbook-brain/web typecheck`
- [x] Step 4: Documentar na wiki (feature + changelog) e preencher review

## Open Questions
- Nenhuma. O usuário pediu refinamento visual do ícone existente.

## Progress Notes
- Root cause visual observado: botão muito pequeno (`24x24`) com ícone fino e composição visual fraca no header.
- Ajuste aplicado no botão de hard refresh em `triage/[id]/page.tsx`: `28x28`, raio `9px`, fundo/borda mais intencionais e glyph de refresh com traço mais grosso (`1.7`) e geometria mais equilibrada.
- Adicionados estados de hover simples (lift + contraste) sem alterar comportamento.
- Verificação: `pnpm --filter @playbook-brain/web typecheck` OK.
- Wiki atualizada com feature + changelog do polish visual.

## Review
- What worked: mudança extremamente localizada no botão específico do header, sem tocar no fluxo de refresh.
- What was tricky: melhorar legibilidade/estética sem "estourar" o peso visual ao lado do badge `Playbook ready`.
- Time taken: ~10 min

## Task: Fase 3 completa — Diagnose grounding/calibration + integração com Validate/Playbook (2026-02-24)
**Status**: completed
**Started**: 2026-02-24

## Plan
- [x] Step 1: Fortalecer `Diagnose` com grounding/relevance scoring + calibrated confidence
- [x] Step 2: Integrar metadata de hipótese no `Validate & Policy` (unsupported top hypothesis, anchor eligibility)
- [x] Step 3: Integrar `PlaybookWriter` para preferir hipóteses `playbook_anchor_eligible`
- [x] Step 4: Adicionar/ajustar testes e validar `typecheck`
- [x] Step 5: Documentar tudo na wiki

## Progress Notes
- `apps/api/src/services/diagnose.ts`: pós-processamento determinístico das hipóteses adicionando `support_score`, `relevance_score`, `grounding_status`, `calibrated_confidence`, `playbook_anchor_eligible` e reranking por confiança calibrada.
- `apps/api/src/services/validate-policy.ts`: bloqueio explícito quando top hypothesis está `unsupported`, advisory quando nenhuma hipótese é `anchor` e compatibilidade preservada para diagnósticos legados sem campo `playbook_anchor_eligible`.
- `apps/api/src/services/playbook-writer.ts`: prompt agora inclui bloco `HYPOTHESIS QUALITY`; checklist/alinhamento ignora hipóteses `anchor=no` como obrigatórias e preserva labels H1/H2/H3 originais após filtro.
- `packages/types/src/index.ts`: campos opcionais adicionados ao tipo `Hypothesis` para metadata de grounding/calibração.
- Testes adicionados/ajustados:
  - `diagnose-calibration`
  - `validate-policy-gates`
  - `playbook-writer-alignment`
- Verificações:
  - `pnpm --filter @playbook-brain/api test -- diagnose-calibration` ✅
  - `pnpm --filter @playbook-brain/api test -- validate-policy-gates` ✅
  - `pnpm --filter @playbook-brain/api test -- playbook-writer-alignment` ✅
  - `pnpm --filter @playbook-brain/api typecheck` ✅

## Review
- What worked: integração incremental pós-LLM permitiu fortalecer diagnóstico sem quebrar payloads existentes; `Validate` e `PlaybookWriter` passaram a consumir os novos sinais com compatibilidade para tickets antigos.
- What was tricky: alinhar regras novas com comportamento já existente de `advisor mode` e manter labels de hipótese (`H1/H2/H3`) consistentes ao filtrar hipóteses não-âncora.
- Time taken: ~45 min

## Task: Fase 4 completa — Validate & Policy (2026-02-24)
**Status**: completed
**Started**: 2026-02-24

## Plan
- [x] Step 1: Auditar `Validate & Policy` atual contra contrato da Fase 4 (destrutivo, prova, corroboration)
- [x] Step 2: Implementar gaps (principalmente regra de corroboration para hipóteses amplas como ISP/região)
- [x] Step 3: Adicionar/ajustar testes do `ValidatePolicyService`
- [x] Step 4: Validar `typecheck` + testes focados
- [x] Step 5: Documentar na wiki e preencher review

## Open Questions
- Decisão aplicada: falta de corroboração para hipótese ampla de provider/região vira hard quality stop (`safe_to_generate_playbook=false`) para impedir ancoragem sem prova.

## Progress Notes
- Auditoria confirmou boa cobertura prévia de Fase 4 (evidence-per-claim, risk gates, cross-tenant rejection, quality/coverage gates), mas dois gaps frente ao contrato do usuário:
  - ações destrutivas só eram tratadas como bloqueio forte em ticket `Critical`
  - não existia gate de corroboração para hipóteses amplas de ISP/provedor/região/outage
- `apps/api/src/services/validate-policy.ts` recebeu:
  - `destructive_action_requires_human_approval` (risk gate) para ações destrutivas sem qualifier explícito de aprovação humana/janela de mudança
  - `broad_hypothesis_corroboration_missing` (quality gate + hard stop) quando hipótese top-1 aponta para ISP/provedor/região sem corroboração em `external_status`, `related_cases` ou evidência de impacto em pares
  - compatibilidade preservada com `advisor mode` para outros gates não-hard
- Padrão destrutivo ampliado para cobrir `factory reset` / `reset firewall`
- Testes adicionados em `validate-policy-gates` para:
  - hipótese ISP sem corroboração => bloqueio
  - remediação destrutiva sem aprovação => bloqueio
- Verificações:
  - `pnpm --filter @playbook-brain/api test -- validate-policy-gates` ✅
  - `pnpm --filter @playbook-brain/api typecheck` ✅

## Review
- What worked: os novos guardrails se encaixaram no `ValidatePolicyService` sem mudar o contrato externo (`ValidationOutput`) e reforçam exatamente os exemplos do usuário (destrutivo sem aprovação, ISP sem corroboration).
- What was tricky: manter o comportamento de `advisor mode` sem diluir a regra “nada de chute”; a solução foi classificar os novos casos como hard stops específicos.
- Time taken: ~25 min
