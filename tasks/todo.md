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

## Review
(fill in after completion)
- What worked:
- What was tricky:
- Time taken:
