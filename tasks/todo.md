# Task: Sidebar header destacado como módulo separado (gutter estrutural real) (2026-02-24)
**Status**: completed
**Started**: 2026-02-24

## Plan
- [x] Step 1: Revisar a estrutura atual da `ChatSidebar` e identificar por que o ajuste anterior não criou separação modular real
- [x] Step 2: Refatorar o layout para separar `busca + hora/toggle` em um wrapper/panel próprio, com gap real para o restante da sidebar
- [x] Step 3: Validar via diff/screenshot semantics (sem divider/cor nova; destaque por estrutura) e atualizar wiki/changelog

## Open Questions
- Nenhuma. O requisito foi esclarecido pelo usuário com screenshot: destaque equivalente ao padrão de separação entre colunas (módulos distintos com vão real).

## Progress Notes
- Correção do usuário confirmou que o ajuste anterior criou apenas espaço interno (`spacer`) e não separação estrutural entre módulos.
- Root cause definido: interpretação incorreta de “gutter” como `margin/height spacer` dentro do mesmo bloco contínuo.
- `ChatSidebar` foi refatorada para dois wrappers internos (header e conteúdo) com `gap: 8px`, reproduzindo a semântica visual de separação modular usada entre colunas.
- Verificação: `pnpm --filter @playbook-brain/web typecheck` OK.
- Novo feedback com screenshot alvo exigiu paridade visual mais forte; ajuste fino aplicado na geometria dos módulos (`gap`, `padding`, `borderRadius`) para aproximar da referência.
- Verificação pós-tuning: `pnpm --filter @playbook-brain/web typecheck` OK.

## Review
(fill in after completion)
- What worked: separar a sidebar em dois wrappers/panels internos resolveu o problema na raiz (destaque modular real), sem alterar lógica, dados ou componentes internos.
- What was tricky: o requisito parecia um ajuste de spacing, mas dependia de semântica estrutural do layout (container boundaries) e depois de tuning geométrico fino (intensidade do gap/raio), não apenas `margin/gap` local.
- Time taken: ~25 min (incluindo correções após feedback)

---

# Task: LLM-first rich formatting for Clean ticket text (preserve signature) (2026-02-24)
**Status**: completed
**Started**: 2026-02-24

## Plan
- [x] Step 1: Locate `text_clean` generation path and UI consumption for the `Clean` toggle
- [x] Step 2: Extend LLM normalization prompt to produce a rich Markdown display variant that preserves signature/contact block
- [x] Step 3: Persist the display-format artifact metadata (`markdown_llm` vs plain fallback) without breaking existing tickets
- [x] Step 4: Update frontend `Clean` rendering to trust/render LLM markdown when flagged, keep heuristic formatter for legacy/fallback plain text
- [x] Step 5: Verify with `pnpm --filter @playbook-brain/api typecheck` and `pnpm --filter @playbook-brain/web typecheck`
- [x] Step 6: Document in wiki (feature/changelog)

## Open Questions
- Keep `text_clean` as canonical pipeline-clean text (plain) and add a separate display markdown field to avoid polluting enrichment inputs.

## Progress Notes
- User confirmed the desired direction: rich formatting should be LLM-driven, with signature preserved (`signature stays`).
- Backend `normalizeTicketForPipeline(...)` extended to ask the LLM for a new `description_display_markdown` field (rich markdown, signature preserved) while keeping `description_canonical` plain/clean for pipeline use.
- Added post-processing guard for LLM markdown display text (strip code fences/HTML leftovers/common wrappers; keep signature content).
- `ticket_text_artifact` now persists `text_clean_display_markdown` plus `text_clean_display_format` (`markdown_llm` vs `plain` fallback).
- Triage page now prefers the display markdown for `Clean` and removed the old verbose `Cleaned ticket text...` prefix from the UI payload.
- `ChatMessage` now renders `Clean` directly as markdown when `cleanFormat === markdown_llm`, and keeps the heuristic formatter only for plain/legacy tickets.
- Verification: `pnpm --filter @playbook-brain/api typecheck` and `pnpm --filter @playbook-brain/web typecheck` OK.
- Follow-up bugfix after user validation: keep rich formatting but prevent LLM wording changes in `Clean`.
- `description_display_markdown` prompt hardened to `FORMAT ONLY` (no paraphrase/reinterpretation).
- Added verbatim guard (markdown-stripped output vs canonical cleaned text) and a strict LLM retry path for formatting-only output before plain fallback.
- Verification follow-up: `pnpm --filter @playbook-brain/api typecheck` OK.
- Follow-up bugfix after screenshot validation: verbatim guard was too strict and rejected valid rich formatting (headers/list labels/table labels), causing plain-text fallback.
- Guard adjusted to allow formatting-only additions using high source-token coverage + low novel-token ratio (with a formatting-label allowlist), while still blocking paraphrase-heavy outputs.
- Verification follow-up: `pnpm --filter @playbook-brain/api typecheck` OK.
- Simplificação final aplicada após feedback do usuário: `description_display_markdown` deixou de ser gerado na mesma prompt de normalização (que também gera `description_ui` reinterpreted).
- Agora o rich formatting do `Clean` é uma chamada LLM separada, **strict format-only**, executada sobre o `description_canonical` já limpo.
- Isso reduz contaminação semântica entre objetivos (`normalize/reinterpret` vs `format-only`) e implementa exatamente o contrato pedido: limpar gibberish + formatar + manter texto original + assinatura.
- Verification follow-up: `pnpm --filter @playbook-brain/api typecheck` OK.
- Follow-up bugfix after latest screenshot: strict formatter prompt was over-constrained and effectively blocked useful structure (e.g. `Request` / `Signature` headings), resulting in almost plain text.
- Formatter prompt now allows **minimal generic labels/headings** while preserving original wording and facts.
- Verification follow-up: `pnpm --filter @playbook-brain/api typecheck` OK.
- Follow-up bugfix after Phase 1 vs Phase 2 comparison: formatter prompt was still too weak on roster/table preference, so similar onboarding tickets could diverge (one tabular, one plain list).
- Formatter prompt now explicitly prefers Markdown tables for repeated people rosters (3+ person-like entries), including ambiguity handling (`Name | Details` fallback) without dropping merged/unclear rows.
- Verification follow-up: `pnpm --filter @playbook-brain/api typecheck` OK.

## Review
(fill in after completion)
- What worked: separating `description_canonical` (pipeline) from `description_display_markdown` (UI) avoided contaminating enrichment inputs; decoupling the display-format LLM call from the normalization prompt further aligned behavior with the product contract.
- What was tricky: preserving backward compatibility for existing tickets required a format flag and a frontend fallback path instead of replacing `text_clean` semantics; later, the semantic guard needed both a strict-retry step and a more formatting-tolerant validator to avoid false plain-text fallback.
- Time taken: ~45 min

---

# Task: Clean toggle formatting v2 (roster cards + highlights + badge) (2026-02-24)
**Status**: completed
**Started**: 2026-02-24

## Plan
- [x] Step 1: Expand formatter in `ChatMessage` to produce structured segments for `Clean` text
- [x] Step 2: Add onboarding roster detection and render roster items as compact visual cards
- [x] Step 3: Add deterministic inline highlighting (dates/deadlines/device-like terms) in `Clean`
- [x] Step 4: Add subtle `formatted` badge in the `Clean` toggle UI
- [x] Step 5: Validate with `pnpm --filter @playbook-brain/web typecheck`
- [x] Step 6: Document in wiki (feature/changelog)

## Open Questions
- We will keep all behavior scoped to `autotask` + `Clean` display only.

## Progress Notes
- Refatorado formatter do `Clean` para gerar modelo estruturado (segments + roster candidates + markdown fallback).
- Adicionado renderer local `RichCleanTicketText` (somente `autotask` + modo `Clean`) com:
  - parágrafos/callouts/signature separados
  - roster onboarding renderizado em cards compactos
  - highlights heurísticos para datas/deadlines/device-like termos
- Adicionado badge sutil `fmt` ao botão `Clean` quando a visualização está enriquecida por heurística.
- Verificação: `pnpm --filter @playbook-brain/web typecheck` OK.
- Feedback do usuário: visual ficou confuso/feio; cards de roster transmitiam falsa precisão (`Adam Patton 1099`, `Alicia Smith corp-to-Corp`, etc.).
- Redesign aplicado: `Clean` volta a ser leitura principal; extração heurística virou disclosure colapsável `Detected Users` com tabela compacta e rótulo de baixa confiança.
- Highlights reduzidos para datas/deadlines/ações (removidos chips agressivos de vendors/device no texto corrido).
- `fmt` badge removido do toggle; substituído por helper text discreto `Display formatting applied (heuristic)` abaixo do header.
- Verificação pós-redesign: `pnpm --filter @playbook-brain/web typecheck` OK.
- Novo feedback do usuário: ainda quer algo mais simples (email body formatting).
- Reset aplicado: removidos disclosure/tabela/helper text; `Clean` agora usa formatação simples de corpo de email (parágrafos + listas + notas/assinatura) com helper determinístico.
- Verificação final pós-reset: `pnpm --filter @playbook-brain/web typecheck` OK.
- Ajuste incremental após novo feedback: removido prefixo verboso `Cleaned ticket text (noise removed, meaning preserved):`.
- Adicionada detecção simples de bloco de roster (3+ linhas) no formatter de email body para renderizar como tabela markdown (`Name | Details`); runs menores viram bullet list.
- Verificação: `pnpm --filter @playbook-brain/web typecheck` OK após ajuste de prefixo + list/table detection.
- Melhoria de método após novo feedback ("não resolveu"): formatter agora usa classificação por linha + score de bloco de roster (com fallback seguro), em vez de regex simples por linha.
- Fix crítico: tabela markdown passou a ser emitida como bloco único (linhas contíguas), evitando quebra por `join('\\n\\n')`.
- Verificação: `pnpm --filter @playbook-brain/web typecheck` OK após line-classifier + roster scoring.
- Ajuste adicional baseado no screenshot real: adicionada segunda passada de segmentação para quebrar múltiplas linhas de roster grudadas na mesma linha (ex.: `... laptop Brittany Williams ...`).
- Verificação: `pnpm --filter @playbook-brain/web typecheck` OK após segmentation pass por boundary de pessoa+employment.
- Novo feedback do usuário com screenshot confirmou que "tabela" ainda não aparecia visualmente; root cause refinado: splitter estava superfragmentando linhas (ex.: `Travis Jones`, `Brittany`) e o `MarkdownRenderer` não tinha estilo de tabela, então mesmo quando renderizada a percepção visual era fraca.
- Fix aplicado no formatter: split de roster embutido passou a usar detecção conservadora por matches + stopwords de cargo (evita falso split em `Business Development` / `Williams Marketing`) e merge de fragmentos de nome com a linha seguinte (`Brittany` + `Williams ...`).
- Fix aplicado no render markdown: adicionados estilos explícitos para `<table>/<th>/<td>` em `MarkdownRenderer` para a tabela ficar visualmente clara.
- Verificação: `pnpm --filter @playbook-brain/web typecheck` OK após splitter conservador + table styling.

## Review
- What worked: simplificar para email-body formatting resolveu a direção de UX (legibilidade > parsing visual), e o line-classifier + scoring permaneceu útil como base para detectar roster sem voltar aos cards.
- What was tricky: o caso real tinha linhas de roster coladas e o splitter por regex global começou a quebrar cargos como se fossem nomes; também faltava estilo visual de tabela no renderer.
- Time taken: ~1h20 (incluindo iterações rejeitadas + reset simples)

---

# Task: Rich formatting para texto "Clean" no toggle da center column (2026-02-24)
**Status**: completed
**Started**: 2026-02-24

## Plan
- [x] Step 1: Localizar render do toggle `Clean/Original` e ponto de aplicação de formatação
- [x] Step 2: Implementar formatador heurístico determinístico para texto `Clean` (parágrafos/listas/linhas-chave)
- [x] Step 3: Aplicar somente no modo `Clean` da mensagem `autotask`
- [x] Step 4: Validar com `pnpm --filter @playbook-brain/web typecheck`
- [x] Step 5: Documentar na wiki (feature/changelog)

## Open Questions
- Nenhuma. Estratégia será UI-only, mantendo o texto original intacto e sem alterar payloads/LLM.

## Progress Notes
- Render do toggle `Clean/Original` identificado em `ChatMessage.tsx`, com render final passando por `MarkdownRenderer`.
- Implementado formatador heurístico local (`normalizeCleanTicketTextForDisplay`) aplicado somente ao modo `Clean` em mensagens `autotask`.
- O formatter promove listas numeradas inline (`1. ... 2. ...`) para itens separados, cria parágrafos consistentes e separa callouts comuns (`NOTE`, `GOAL`) e linhas tipo assinatura.
- Verificação: `pnpm --filter @playbook-brain/web typecheck` OK.

## Review
- What worked: mudança localizada no render preserva payloads e melhora legibilidade de forma determinística para todos os tickets já existentes.
- What was tricky: melhorar bastante sem “inventar” conteúdo nem quebrar o texto quando ele já vem parcialmente formatado.
- Time taken: ~25 min

---

# Task: Botão de supressão manual no header da center column (2026-02-24)
**Status**: completed
**Started**: 2026-02-24

## Plan
- [x] Step 1: Mapear ponto do header da triagem e a lógica atual de tickets suprimidos
- [x] Step 2: Implementar override manual de supressão (persistência local) e aplicar overlay na lista
- [x] Step 3: Adicionar ícone toggle ao lado do badge "Playbook ready" e botão de refresh
- [x] Step 4: Validar comportamento (polling/refresh) e rodar `pnpm --filter @playbook-brain/web typecheck`
- [x] Step 5: Migrar supressão manual para backend persistente + endpoint de toggle
- [x] Step 6: Bloquear pipeline/background para tickets manualmente suprimidos
- [x] Step 7: Atualizar frontend para usar backend (remover MVP localStorage)
- [x] Step 8: Revalidar (`api` + `web`) e atualizar wiki/changelog

## Open Questions
- Persistência manual será local (`localStorage`) no MVP; backend não será alterado nesta entrega.

## Progress Notes
- Supressão automática atual vem da rota `email-ingestion/list` (classificação derivada em runtime), sem persistência manual no backend.
- Implementado override manual local (`localStorage`) com merge sobre a lista de tickets para sobreviver ao polling (home + triage detail).
- Adicionado botão de ícone (toggle) no header da center column entre badge `Playbook ready` e botão de refresh, com `aria-label`/`aria-pressed`.
- Verificação: `pnpm --filter @playbook-brain/web typecheck` OK.
- Correção do usuário válida: supressão manual deve ser backend-enforced para evitar gasto de pipeline/token; tarefa reaberta para implementar persistência + guard operacional.
- Supressão manual migrada para backend (`tickets_processed.manual_suppressed` + endpoint `PATCH /email-ingestion/tickets/:ticketId/manual-suppression`).
- Lista `/email-ingestion/list` agora mescla supressão automática + manual persistida e expõe `manual_suppressed`.
- `triageOrchestrator.runPipeline(...)` agora aborta cedo para tickets manualmente suprimidos e bloqueia sessão mais recente (`blocked`, `last_error = manual suppression`).
- `/playbook/full-flow` não agenda background processing para tickets manualmente suprimidos e responde fluxo como `⛔ Suppressed` quando aplicável.
- Verificação final: `pnpm --filter @playbook-brain/api typecheck` e `pnpm --filter @playbook-brain/web typecheck` OK.
- Regressão reportada pelo usuário: tickets suprimidos manualmente (sem sessão) não reapareciam ao desligar filtro e contador de suprimidos ficava incorreto.
- Root cause: `/email-ingestion/list` ancorava em `triage_sessions`, excluindo tickets sem sessão.
- Fix: query da sidebar agora ancora em `tickets_processed` com `LEFT JOIN latest_sessions`; `session/evidence/ssot` permanecem opcionais.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK após fix da query da sidebar.

## Review
- What worked: manter a semântica de supressão no backend permitiu resolver UX + economia de pipeline/token com mudanças localizadas (rota list, endpoint toggle, guards em orchestrator/full-flow).
- What was tricky: substituir o MVP local sem regredir o estado visual imediato do botão e da sidebar durante polling.
- Time taken: ~1h30 (incluindo MVP inicial + correção para backend enforcement)

---

# Task: Corrigir contrato dos Passos 1-2 (Despertar + Prepare Context)
**Status**: completed
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
**Status**: completed
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

## Task: Fase 5 completa — Playbook Writer (2026-02-24)
**Status**: completed
**Started**: 2026-02-24

## Plan
- [x] Step 1: Auditar `PlaybookWriter` contra contrato da Fase 5 (Contexto/Hipóteses/Checklist/Escalação)
- [x] Step 2: Implementar gaps de formato/validação para garantir saída “guia de campo” direto ao técnico
- [x] Step 3: Adicionar/ajustar testes de estrutura do playbook
- [x] Step 4: Validar testes focados + `typecheck`
- [x] Step 5: Documentar na wiki e preencher review

## Open Questions
- Não bloqueante para backend. A Fase 5 foi fechada no writer/contract; render da UI pode permanecer agnóstico às labels enquanto consome Markdown.

## Progress Notes
- Auditoria identificou gap principal: `PlaybookWriter` já pedia uma boa estrutura no prompt, mas `validatePlaybookStructure()` só emitia `console.warn` e não exigia (nem testava) seções essenciais da narrativa da Fase 5.
- `apps/api/src/services/playbook-writer.ts` atualizado para:
  - reforçar prompt com seções explícitas `Context`, `Hypotheses`, `Checklist`, `Escalation`
  - manter compatibilidade aceitando aliases (`Overview`/`Root Cause`/`Resolution Steps`) na validação
  - fazer repair automático adicional se faltar seção contratual
  - falhar explicitamente se ainda faltar seção obrigatória após repair
- Novo helper `getMissingPlaybookSections()` implementado e `validatePlaybookStructure()` passou a ser gate real (throw).
- Teste novo `playbook-writer-structure` cobre aceitação com seções do contrato e rejeição sem `Escalation`.
- Verificações:
  - `pnpm --filter @playbook-brain/api test -- playbook-writer-structure` ✅
  - `pnpm --filter @playbook-brain/api test -- playbook-writer-alignment` ✅
  - `pnpm --filter @playbook-brain/api test -- playbook-writer-contamination` ✅
  - `pnpm --filter @playbook-brain/api typecheck` ✅

## Review
- What worked: reforçar o contrato no pós-processamento/validador do writer foi uma mudança pequena e eficaz; não dependemos só do prompt para garantir a forma de “guia de campo”.
- What was tricky: exigir o contrato sem quebrar compatibilidade com playbooks já existentes; a solução foi aceitar aliases de seção na validação (`overview/root cause/resolution steps`) enquanto o prompt passa a orientar para `Context/Hypotheses/Checklist`.
- Time taken: ~25 min

## Task: Fase 6 — Grand Finale UX (2026-02-24)
**Status**: completed
**Started**: 2026-02-24

## Plan
- [x] Step 1: Auditar a experiência final (sidebar -> clique -> playbook pronto) no frontend
- [x] Step 2: Identificar gap principal na entrega “mastigada” do playbook
- [x] Step 3: Implementar preenchimento estruturado de checklist/escalation no painel direito a partir do Markdown
- [x] Step 4: Validar `pnpm --filter @playbook-brain/web typecheck`
- [x] Step 5: Documentar na wiki e preencher review

## Open Questions
- O fluxo continua baseado em polling (não push). Isso não bloqueia a Fase 6 funcional, mas permanece como melhoria futura para sensação de “instantâneo”.

## Progress Notes
- Auditoria mostrou que o ticket já aparecia na sidebar e o playbook podia chegar pronto, mas havia um gap importante no painel direito:
  - `PlaybookPanel` tinha UI para `Checklist` e `Escalation`
  - porém `triage/[id]/page.tsx` só populava `context` e `hypotheses`
  - resultado: checklist ficava vazio/skeleton mesmo com `content_md` pronto
- Implementado parser leve no frontend (`triage/[id]/page.tsx`) para extrair do `playbook.content_md`:
  - seção `Checklist` (ou alias `Resolution Steps`)
  - seção `Escalation` (ou alias `Escalate when`)
- `PlaybookPanel` agora recebe `checklist` e `escalate` estruturados do playbook gerado, reforçando a experiência “formatado e mastigado” para o técnico.
- Verificação:
  - `pnpm --filter @playbook-brain/web typecheck` ✅

## Review
- What worked: correção local no frontend, sem tocar backend/pipeline; reaproveita o Markdown já gerado e preenche a UI estruturada que já existia.
- What was tricky: parser precisava aceitar aliases de seção (`Checklist`/`Resolution Steps`, `Escalation`/`Escalate when`) para compatibilidade com variações de output do Playbook Writer.
- Time taken: ~20 min

## Task: Concurrency hardening (orchestrator + full-flow UPSERT/idempotency) (2026-02-24)
**Status**: completed
**Started**: 2026-02-24 11:59 EST

## Plan
- [x] Step 1: Add minimal DB transaction helper in `apps/api/src/db/index.ts`
- [x] Step 2: Harden `triage-orchestrator` claim/retry path (atomic claim, local reentrancy guard, atomic retry_count)
- [x] Step 3: Add DB dedupe + unique indexes for `llm_outputs`, `validation_results`, `playbooks`
- [x] Step 4: Convert `/playbook/full-flow` and orchestrator artifact writes to UPSERTs compatible with new constraints
- [x] Step 5: Verify with targeted `api` typecheck/tests
- [x] Step 6: Document changes in local wiki (`features` + `changelog`) and fill review

## Open Questions
- Whether to enforce uniqueness on `triage_sessions` (deferred for now; using per-ticket advisory lock in orchestrator path)

## Progress Notes
- Started from concurrency audit findings (P1/P2) on `triage-orchestrator` and `/playbook/full-flow`.
- `apps/api/src/db/index.ts` now exposes `transaction(...)` and returns row counts from `execute(...)` to support atomic multi-step writes.
- `triage-orchestrator` now serializes per-ticket session claim/create with PostgreSQL transaction-scoped advisory lock (`pg_advisory_xact_lock`) + row lock, adds local retry-sweep overlap guard, and locks `retry_count` updates with `FOR UPDATE`.
- Artifact writes in `triage-orchestrator` and `/playbook/full-flow` background path were converted from `SELECT -> UPDATE/INSERT` check-then-act flows into single-statement UPSERTs.
- Added migration `014_concurrency_idempotency_indexes.sql` to dedupe existing duplicates and create unique indexes required by the new UPSERT paths (`llm_outputs(session_id, step)`, `validation_results(session_id)`, `playbooks(session_id)`).
- `init.sql` aligned with the same uniqueness guarantees for fresh environments.
- Verification: `pnpm --filter @playbook-brain/api typecheck` OK after final patch set.
- Wiki updated with feature + changelog entries for the concurrency hardening change.

## Review
- What worked: pairing application-level serialization (advisory lock) with DB uniqueness/UPSERT removed the two main race patterns without broad refactors.
- What was tricky: adding uniqueness safely required a dedupe migration first; otherwise `CREATE UNIQUE INDEX` would fail on preexisting duplicate rows.
- Time taken: ~45 min

## Task: Concurrency hardening (P2 full-flow session create + poller distributed locks) (2026-02-24)
**Status**: completed
**Started**: 2026-02-24 12:15 EST

## Plan
- [x] Step 1: Make `/playbook/full-flow` ticket session resolve/create atomic with DB transaction + advisory lock
- [x] Step 2: Add distributed advisory locks to `AutotaskPollingService` and `EmailIngestionPollingService` (retain local `isPolling` as process guard)
- [x] Step 3: Verify `api` typecheck
- [x] Step 4: Document changes in wiki (`features` + `changelog`) and fill review

## Open Questions
- None blocking. We will use Postgres advisory locks (session-level for pollers, transaction-level for full-flow create) to avoid schema changes on `triage_sessions` in this pass.

## Progress Notes
- Requested scope: audit findings P2 full-flow auto-create race and poller local-only `isPolling` multi-instance gap.
- `/playbook/full-flow` now resolves or creates ticket sessions inside a DB transaction with `pg_advisory_xact_lock(..., hashtext(ticketId))`, eliminating the check-then-insert race for concurrent requests on the same ticket.
- Added reusable DB helper `withTryAdvisoryLock(...)` (session-level advisory lock) in `apps/api/src/db/index.ts` for cross-instance coordination of long-running poll cycles.
- `AutotaskPollingService` and `EmailIngestionPollingService` now require a DB-backed advisory lock before polling work; local `isPolling` remains as same-process reentrancy guard.
- Verification: `pnpm --filter @playbook-brain/api typecheck` OK.
- Wiki updated with feature + changelog entries for the P2 concurrency fixes.

## Review
- What worked: advisory locks provided a minimal fix without changing `triage_sessions` schema or adding a distributed scheduler.
- What was tricky: poller coordination needs cross-instance locking without holding an open SQL transaction during external API calls, so session-level advisory locks were the right fit.
- Time taken: ~25 min

## Task: Fix `scripts/stack.sh` restart/status hang on health checks (2026-02-24)
**Status**: completed
**Started**: 2026-02-24 12:33 EST

## Plan
- [x] Step 1: Patch `scripts/stack.sh` health curls to fail fast (timeouts)
- [x] Step 2: Verify `./scripts/stack.sh status` returns promptly
- [x] Step 3: Document in wiki (`features` + `changelog`) and fill review

## Open Questions
- None. Repro indicates `status` hangs in health curl path; minimal timeout fix is sufficient.

## Progress Notes
- Reproduced hang: `./scripts/stack.sh status` printed through `api health: ok` and then stalled (web curl path).
- Added `curl_health()` helper with `--connect-timeout 1 --max-time 2` and reused it in `wait_ready()` + `cmd_status()`.
- Verification: `./scripts/stack.sh status` now returns promptly (reported `web health: down` instead of hanging).
- Verification: `./scripts/stack.sh restart` completed end-to-end and reported both services healthy.

## Review
- What worked: minimal shell patch fixed both `status` and `restart` because both paths shared the same unbounded curl behavior.
- What was tricky: reproducing on macOS needed manual observation (no `timeout` command installed by default).
- Time taken: ~12 min

## Task: Remove `Reframed` toggle option from ticket text view (keep Clean + Original) (2026-02-24)
**Status**: completed
**Started**: 2026-02-24 12:42 EST

## Plan
- [x] Step 1: Patch `ChatMessage` text-mode toggle to remove `Reframed`
- [x] Step 2: Verify `web` typecheck
- [x] Step 3: Document in wiki (`features` + `changelog`) and fill review

## Open Questions
- None. Request is explicit: keep only `Clean` and `Original`.

## Progress Notes
- Located toggle in `apps/web/src/components/ChatMessage.tsx` (`reinterpreted` / `clean` / `original`).
- Removed `Reframed` button from the UI toggle; options now render only `Clean` and `Original`.
- Adjusted initial selection/fallback to prefer `clean` when available, otherwise `original`, preventing hidden `reinterpreted` state.
- Verification: `pnpm --filter @playbook-brain/web typecheck` OK.

## Review
- What worked: the toggle was isolated in `ChatMessage`, so the change was localized and low-risk.
- What was tricky: preserving safe fallback behavior when `clean` is missing while removing the `reinterpreted` option from the UI.
- Time taken: ~10 min

## Task: Remove `reframed/reinterpreted` entirely from codebase ticket-text flow (2026-02-24)
**Status**: completed
**Started**: 2026-02-24 12:48 EST

## Plan
- [x] Step 1: Remove `reinterpreted/reframed` fields/usages from web timeline message types and builders
- [x] Step 2: Remove `*_reinterpreted` fields from current `ticket_text_artifact` production path in API
- [x] Step 3: Verify `api` + `web` typecheck and no remaining code references
- [x] Step 4: Document in wiki (`features` + `changelog`) and fill review

## Open Questions
- None. User clarified scope explicitly: remove from codebase, not only from UI.

## Progress Notes
- User corrected prior scope: previous patch only removed the UI option; this task removes the `reframed/reinterpreted` concept from active code paths.
- `apps/web/src/components/ChatMessage.tsx` ticket text variant model now uses only `primary: 'clean' | 'original'` and no `reinterpreted` field.
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx` no longer reads `ticket_text_artifact.text_reinterpreted` / `title_reinterpreted`; the primary timeline text uses `text_clean` when available.
- `apps/api/src/services/prepare-context.ts` no longer persists `title_reinterpreted` / `text_reinterpreted` in the current `ticket_text_artifact` payload.
- Verification: global code search (`rg`) for `reframed|reinterpreted|text_reinterpreted|title_reinterpreted` in `*.ts/*.tsx/*.js/*.json` returned no matches.
- Verification: `pnpm --filter @playbook-brain/api typecheck` OK; `pnpm --filter @playbook-brain/web typecheck` OK (after fixing one TS conditional cast).

## Review
- What worked: a global reference search made the scope explicit and allowed a coordinated API+web cleanup.
- What was tricky: the prior UI-only patch left hidden model references; removing the concept required updating both the message type and timeline signature serialization.
- Time taken: ~18 min

## Task: Improve `Clean` ticket text signature detection/formatting (2026-02-24)
**Status**: verifying
**Started**: 2026-02-24 12:49 EST

## Plan
- [x] Step 1: Locate `text_clean` normalization/post-processing path in `PrepareContext`
- [x] Step 2: Add deterministic email-signature formatting heuristics for `Clean` text output
- [x] Step 3: Add regression test for flattened signature formatting
- [x] Step 4: Verify targeted test + typechecks
- [x] Step 5: Document in wiki (`features` + `changelog`) and fill review

## Open Questions
- None blocking. Heuristic formatting is acceptable for v1 and can be tuned with more examples later.

## Progress Notes
- Root cause identified in `postProcessCanonicalTicketText(...)`: final `\s+` collapse flattened the entire canonical text (including signature/contact blocks) into one line.
- Added signature-aware formatting pass that detects likely signature start and reinserts readable line breaks for signoff, contact labels, email/phone/website, and address starts.
- Added regression test case with a flattened email signature (Alex Hall example style).
- Verification: `pnpm --filter @playbook-brain/api test -- prepare-context.test` OK.
- Verification: `pnpm --filter @playbook-brain/api typecheck` OK.
- Wiki updated with feature + changelog entries for clean-text signature formatting.

## Review
- What worked: fixing the canonical-text post-processing (`postProcessCanonicalTicketText`) solved the issue at the source for all `Clean` consumers, instead of patching UI rendering.
- What was tricky: the first heuristic over-split some signature parts (`Direct:` and phone number, `Sr.` suffix); a small rejoin pass stabilized the formatting.
- Time taken: ~25 min
## Task: Corrigir `company` derivado de domínio persistindo na UI/SSOT (2026-02-24)
**Status**: completed
**Started**: 2026-02-24

## Plan
- [x] Step 1: Traçar fluxo `ticket.company` -> `PrepareContext` -> `ticket_ssot` -> UI
- [x] Step 2: Confirmar root cause (anti-regressão + precedência inicial preservando fallback de domínio)
- [x] Step 3: Corrigir seleção/preservação de `company` com heurística mínima para detectar fallback de domínio
- [x] Step 4: Validar `typecheck` (`api` e `web`)
- [x] Step 5: Documentar na wiki (feature + changelog)

## Open Questions
- Nenhuma. A correção é no pipeline/SSOT; UI permanece SSOT-only.

## Progress Notes
- Root cause confirmado em `PrepareContext`: `companyName` priorizava `ticket.company` antes de `inferredCompany`, e `applyIntakeAntiRegressionToSSOT()` preservava `ticket.company` incondicionalmente.
- Adicionados helpers para identificar rótulos de empresa provavelmente derivados de domínio e permitir substituição apenas quando houver nome display-ready melhor.
- `companyName` inicial agora passa por seleção preferencial (`intake` vs `inferred`) antes do restante do pipeline.
- Anti-regressão do SSOT agora preserva intake **exceto** quando o intake parece fallback de domínio e há candidato melhor (SSOT atual ou inferido).
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK.
- Verificação: `pnpm --filter @playbook-brain/web typecheck` OK.

## Review
- What worked: correção centralizada em `PrepareContext`, sem workaround na UI.
- What was tricky: preservar o contrato “intake canônico” sem congelar valores de baixa qualidade (fallback de domínio).
- Time taken: ~15 min
## Task: Reduzir falhas por quota/rate-limit no `/playbook/full-flow` (2026-02-24)
**Status**: completed
**Started**: 2026-02-24

## Plan
- [x] Step 1: Inspecionar handling de `429/quota` no `llm-adapter` e no orquestrador
- [x] Step 2: Inspecionar `/playbook/full-flow` para loops de re-trigger sob polling
- [x] Step 3: Implementar backoff persistido (`retry_count/next_retry_at`) na rota para erros transitórios
- [x] Step 4: Impedir re-trigger enquanto `next_retry_at` futuro estiver ativo
- [x] Step 5: Validar `api` typecheck e documentar na wiki

## Open Questions
- Não consegui confirmar por SQL nesta sessão porque `DATABASE_URL` não está carregado no shell atual.
- Ainda pode haver amplificação adicional em multi-instância (o guard `fullFlowInFlight` é in-memory), mas esta correção elimina o loop local/polling mais provável.

## Progress Notes
- Auditoria de código mostrou que `triage-orchestrator` já persistia backoff (`retry_count/next_retry_at`) para 429/quota, mas `/playbook/full-flow` não.
- `triggerBackgroundProcessing()` em `apps/api/src/routes/playbook.ts` marcava erro transitório só como `pending`, sem `next_retry_at`, permitindo re-trigger imediato em cada polling da UI.
- Fix aplicado: rota agora usa `markSessionPendingForRetry()` (com exponential backoff persistido) para erros transitórios e limpa retry metadata em sucesso/falha não transitória.
- Fix aplicado: rota respeita `next_retry_at` e não agenda background processing enquanto cooldown estiver ativo.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK.

## Review
- What worked: reaproveitar o mesmo modelo de backoff do orquestrador na rota `/full-flow` sem mexer no pipeline principal.
- What was tricky: o problema não estava só no provider limiter; a rota tinha um path paralelo de retries sem cooldown persistido.
- Time taken: ~20 min

## Task: Diagnosticar falha de 3 tickets (quota vs outras causas) (2026-02-24)
**Status**: completed
**Started**: 2026-02-24

## Plan
- [x] Step 1: Localizar conexão do banco e consultar `triage_sessions` dos 3 tickets
- [x] Step 2: Inspecionar `last_error` + artifacts/steps por sessão para cada ticket
- [x] Step 3: Classificar causas (quota/rate-limit vs bug lógico/outro) com evidência
- [x] Step 4: Reportar achados e próximos passos

## Open Questions
- Se houver múltiplas sessões por ticket, qual delas o usuário considera "a que falhou" (vou analisar todas e destacar a mais recente).

## Progress Notes
- Investigação iniciada via Postgres local padrão do repo (`playbook_brain`).
- `psql` não estava disponível no shell; consultas feitas via `node + pg` usando dependências de `apps/api`.
- Os tickets `T20260224.0020`, `T20260224.0017` e `T20260224.0015` apresentam falha com `last_error = there is no unique or exclusion constraint matching the ON CONFLICT specification` (exceto uma sessão antiga de `manual refresh restart`).
- Evidência de etapa: sessões afetadas já têm `evidence_pack`, mas não têm `llm_outputs`/`validation_results`/`playbooks`, indicando falha logo após `PrepareContext`, na primeira upsert com `ON CONFLICT`.
- Catálogo de índices do banco confirma ausência dos índices únicos necessários em `llm_outputs(session_id, step)`, `validation_results(session_id)` e `playbooks(session_id)`.
- A migration `apps/api/src/db/migrations/014_concurrency_idempotency_indexes.sql` cria exatamente esses índices, sugerindo drift de schema/migration não aplicada.

## Review
- What worked: cruzar `triage_sessions`, presença de artefatos e `pg_indexes` isolou a causa sem depender de logs de app.
- What was tricky: `psql` indisponível no shell; precisei usar `node + pg` para inspeção.
- Time taken: ~15 min

## Task: Aplicar correção de schema para falhas de ON CONFLICT (2026-02-24)
**Status**: completed
**Started**: 2026-02-24

## Plan
- [x] Step 1: Confirmar migration alvo e banco local
- [x] Step 2: Aplicar migration `014_concurrency_idempotency_indexes.sql`
- [x] Step 3: Validar índices únicos criados no banco
- [x] Step 4: Reportar resultado e impacto nos tickets falhos

## Open Questions
- Se o usuário quer que eu também reprocesse os tickets após corrigir o schema (posso fazer na sequência).

## Progress Notes
- Correção autorizada pelo usuário após diagnóstico de schema drift (`ON CONFLICT` sem índices únicos correspondentes).
- Migration `014_concurrency_idempotency_indexes.sql` aplicada com sucesso no banco local `playbook_brain` via `node + pg`.
- Validação em `pg_indexes`: criados `idx_llm_outputs_session_step_unique`, `idx_validation_results_session_unique`, `idx_playbooks_session_unique`.
- Após a correção, os tickets investigados passaram de erro SQL para `pending` com `retry_count/next_retry_at` e `last_error` de quota Gemini (`429 RESOURCE_EXHAUSTED`, free-tier input token limit), confirmando que a causa SQL foi removida.

## Review
- What worked: aplicar diretamente a migration `014` resolveu a incompatibilidade entre `ON CONFLICT` e schema atual sem patch de código.
- What was tricky: `psql` indisponível; a execução/validação precisou ser feita via scripts temporários `node + pg`.
- Time taken: ~10 min

## Task: Corrigir formato de query do Autotask polling (2026-02-25)
**Status**: completed
**Started**: 2026-02-25

## Plan
- [x] Step 1: Confirmar online o formato documentado de `search` na REST API do Autotask
- [x] Step 2: Comparar com `AutotaskClient.searchTickets()` e `AutotaskPollingService`
- [x] Step 3: Corrigir o payload de query para formato documentado (`search` com `filter[]`)
- [x] Step 4: Validar via testes/typecheck e logs do poller após restart
- [x] Step 5: Documentar a correção na wiki

## Open Questions
- Se o Autotask continuar retornando `500` após corrigir o formato, será preciso validar operador/campo (`createDate`) e/ou endpoint específico do tenant.

## Progress Notes
- Encontrado desvio do formato documentado: código enviava `search={op,field,value}` + `pageSize/pageNumber`, sem wrapper `filter[]`.
- Correção implementada em `AutotaskClient.searchTickets()` para montar `search` compatível (`{"MaxRecords":N,"filter":[...]}`) e remover params legados de paginação nessa rota.
- Teste unitário adicionado para validar o querystring gerado no `searchTickets`.

## Review
- What worked: corrigir a montagem de `search` no cliente resolveu a chamada real `/tickets/query`; validação direta retornou `200 OK` com itens.
- What was tricky: o log do poller não mostrou rapidamente o resultado após restart (chamada pendente/assíncrona), então a comprovação final exigiu um teste runtime direto usando a mesma credencial salva em `integration_credentials`.
- Time taken: ~25 min

## Task: Priorizar Autotask/Ninja/IT Glue com email como fallback (2026-02-25)
**Status**: completed
**Started**: 2026-02-25

## Plan
- [x] Step 1: Auditar o ponto de decisão de intake no pipeline (`PrepareContext` / orchestrator / pollers)
- [x] Step 2: Implementar prioridade Autotask para tickets `T...` (buscar no Autotask por `ticketNumber`) e manter email como fallback
- [x] Step 3: Garantir compatibilidade do `AutotaskClient` com shape real de resposta de query (`items`)
- [x] Step 4: Validar por testes + chamada runtime + evidência de logs
- [x] Step 5: Documentar mudança na wiki

## Open Questions
- Se o tenant Autotask não permitir `ticketNumber eq`, pode ser necessário fallback para busca por `contains` + filtragem local.

## Progress Notes
- Usuário quer pipeline único com fontes operacionais primárias (Autotask/Ninja/IT Glue) e email apenas como fallback.
- `PrepareContext` foi alterado para, em tickets `T...`, tentar primeiro `AutotaskClient.getTicketByTicketNumber()` e só então cair para `tickets_processed`/`tickets_raw`.
- `AutotaskClient` passou a aceitar respostas de query em `items` (shape real observado) além de `records`.
- Validação runtime consolidada com credenciais do banco confirmou leitura de dados em Autotask, NinjaOne e IT Glue.
- Logs confirmaram fallback explícito quando Autotask não encontra o ticket (`404`): `Autotask primary lookup failed ... falling back to email ingestion data`.

## Review
- What worked: mudar a priorização no `PrepareContext` + corrigir o shape `items` no client resolveu a origem primária sem reescrever o pipeline.
- What was tricky: alguns tickets `T...` ainda podem não existir/estar visíveis no Autotask na hora do processamento; nesses casos o fallback por email foi mantido e validado.
- Time taken: ~30 min

## Task: Remover email do pipeline (usar apenas fontes configuráveis na UI) (2026-02-25)
**Status**: completed
**Started**: 2026-02-25

## Plan
- [x] Step 1: Identificar todos os pontos ativos de email no runtime (poller/rota/fallback em PrepareContext)
- [x] Step 2: Remover fallback de email no `PrepareContext` (Autotask-only intake)
- [x] Step 3: Desativar runtime de email ingestion (poller + rota pública)
- [x] Step 4: Validar typecheck + restart + logs (sem email poller)
- [x] Step 5: Documentar mudança na wiki

## Open Questions
- O código de email ingestion pode permanecer no repo (inativo) sem impacto; remoção física completa pode ser feita depois se desejado.

## Progress Notes
- Fallback `tickets_processed`/`tickets_raw` foi removido da fase de intake do `PrepareContext`.
- T-format tickets agora dependem exclusivamente de lookup no Autotask por `ticketNumber`.
- `index.ts` não monta mais `/email-ingestion` e não inicia `EmailIngestionPollingService`.
- Validação runtime confirmou: `/email-ingestion` agora retorna `404` e não há logs de startup do `EmailIngestionPolling`.
- Ajuste adicional no `AutotaskClient`: endpoints por ID também aceitam shape `item` (além de `records/items`), evitando parse incompatível do tenant.

## Review
- What worked: remoção do email no runtime foi simples e verificável (rota + poller + fallback de intake).
- What was tricky: apareceram falhas em sessões antigas do poller (`Cannot prepare context without valid ticket from Autotask`) que indicam um problema separado de credencial/sessão/tenant em retries, não fallback de email.
- Time taken: ~25 min

## Task: Corrigir falha crítica `Cannot prepare context without valid ticket from Autotask` (2026-02-25)
**Status**: completed
**Started**: 2026-02-25

## Plan
- [x] Step 1: Reproduzir e identificar causa raiz (sessão/tenant/credencial vs parse/endpoint) com evidência de logs + DB
- [x] Step 2: Implementar correção mínima no caminho Autotask-only (sem reintroduzir email fallback)
- [x] Step 3: Validar com runtime real (poller) e/ou chamada direta ao `PrepareContext`
- [x] Step 4: Documentar mudança na wiki

## Open Questions
- As sessões que falham são retries antigas com `tenant_id`/credenciais tenant-scoped inválidas? (hipótese principal)

## Progress Notes
- Usuário corretamente classificou o erro como crítico, pois ele quebra a Fase 1 do pipeline logo após o poller detectar tickets válidos.
- Causa raiz confirmada: `PrepareContext.buildAutotaskClient()` aplicava `AUTOTASK_ZONE_URL` do env mesmo quando usava credenciais da UI/DB; isso podia forçar zona incorreta/placeholder e quebrar `getTicket()` no runtime.
- O poller consultava Autotask com sucesso porque ele usa as credenciais DB sem forçar o `zoneUrl` do env.
- Fix aplicado: `PrepareContext` só usa `AUTOTASK_ZONE_URL` do env quando não há credencial DB; com credencial da UI, deixa zone discovery automático (ou usa `zoneUrl` da própria credencial DB).
- Validação: reprodução direta de `PrepareContext.prepare()` para sessão que falhava (`132753`) passou; sessões `132753`/`132754` voltaram para `processing` após restart.

## Review
- What worked: isolar diferença entre poller e `PrepareContext` (ambos Autotask) revelou bug de composição de client/zone, não bug de API.
- What was tricky: o erro genérico mascarava a causa; precisei cruzar logs, sessões, credenciais e reproduzir `PrepareContext` diretamente.
- Time taken: ~20 min

## Task: Mapear dados possíveis a partir do ticket Autotask inicial (2026-02-25)
**Status**: planning
**Started**: 2026-02-25

## Plan
- [x] Step 1: Consultar documentação oficial Autotask REST sobre Ticket entity e endpoints relacionados
- [x] Step 2: Mapear o que pode ser obtido diretamente do ticket inicial vs chamadas derivadas
- [x] Step 3: Responder em linguagem humana (ordem, lista de dados, forma de execução)

## Open Questions
- Se o tenant expõe campos/UDFs customizados além do schema base, a documentação lista capacidade geral, mas os campos reais dependem da conta.

## Progress Notes
- Pedido é de análise funcional do fluxo; sem alteração de código.
- Docs oficiais consultadas: `Tickets` entity, `TicketNotes` entity, e mapeamento de campos de webhooks para `Tickets`.
- Mapeado em duas camadas: (a) dados do ticket payload; (b) dados derivados via child endpoints/IDs do próprio ticket.

## Review
- What worked: combinar `Tickets` + `TicketNotes` + mapeamento de webhook deu um quadro claro do que entra “de graça” no início do fluxo.
- What was tricky: a documentação de campos é extensa; para responder de forma útil foi melhor organizar por categorias (direto vs derivado via IDs).
- Time taken: ~15 min

## Task: Promover campos manuais do Autotask para SSOT canônico (2026-02-25)
**Status**: completed
**Started**: 2026-02-25

## Plan
- [x] Step 1: Mapear persistência de `ticket_ssot` e payload servido para UI
- [x] Step 2: Persistir campos autoritativos do Autotask no SSOT (IDs + campos manuais)
- [x] Step 3: Priorizar esses campos no payload da API consumido pela UI
- [x] Step 4: Validar persistência real no banco + typecheck
- [x] Step 5: Documentar mudança na wiki

## Open Questions
- `companyID/contactID/assignedResourceID` ainda não são exibidos visualmente na UI; agora estão disponíveis no SSOT e no payload canônico da API para uso consistente futuro.

## Progress Notes
- Adicionado bloco `autotask_authoritative` no `ticket_ssot.payload`.
- `ticket_id` e `title` top-level do SSOT agora podem ser ancorados nos valores autoritativos do Autotask.
- `playbook` route passou a priorizar `ssot.autotask_authoritative` para `id/title/description` e expor `company_id/contact_id/assigned_resource_id`.
- Validação em banco confirmou persistência de `ticket_number`, `ticket_id_numeric`, `company_id`, `contact_id`, `assigned_resource_id` para o ticket `132753`.

## Review
- What worked: usar um bloco canônico `autotask_authoritative` evita sobrescrever semânticas existentes (`description_clean`) e reduz duplicação de lógica na UI.
- What was tricky: preservar `description_clean` normalizada enquanto garante distribuição do texto manual/autoritativo via payload canônico.
- Time taken: ~20 min

---

# Task: Tickets chegam via Autotask mas não aparecem no Cerebro (sidebar/list) (2026-02-25)
**Status**: completed
**Started**: 2026-02-25

## Plan
- [x] Step 1: Reproduzir e confirmar diferença entre poller (Autotask) e endpoint de listagem da UI
- [x] Step 2: Corrigir `/email-ingestion/list` para listar tickets de `triage_sessions` além de `tickets_processed`
- [x] Step 3: Verificar endpoint/UI após correção e atualizar wiki/changelog

## Open Questions
- Se a sidebar deve exibir `ticketNumber` canônico (`T...`) para sessões Autotask cujo `triage_sessions.ticket_id` é numérico. Nesta correção, foco é visibilidade (aparecer na lista).

## Progress Notes
- Reproduzido: logs mostram `AutotaskPolling` encontrando tickets e `PrepareContext` lendo ticket Autotask, enquanto `/email-ingestion/list` ainda é ancorado em `tickets_processed`.
- Evidência: `triage_sessions` contém tickets recentes numéricos (`132765`, `132764`, ...), mas a query da rota `/email-ingestion/list` parte de `tickets_processed`, que representa principalmente o histórico legado/email.
- Fix aplicado: query da listagem agora usa `ticket_keys` (`tickets_processed.id UNION triage_sessions.ticket_id`) e mantém os joins/mapper atuais (`evidence_packs`, `ticket_ssot`) por `ticket_id`.
- Verificação: `/email-ingestion/list` passou de `146` para `163` itens; topo da lista agora inclui tickets Autotask-only (`132765`, `132764`, `132763`, ...).
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK.

## Review
(fill in after completion)
- What worked: corrigir a âncora da query na rota da sidebar resolveu o problema na raiz sem mexer na UI nem no poller.
- What was tricky: a rota `/email-ingestion/list` foi mantida por compatibilidade de UI, então o bug parecia de frontend mas era um desacoplamento de fonte de dados no backend.
- Time taken: ~20 min

---

# Task: SSOT Autotask authoritative fields ainda incompleto (org permanece unknown) (2026-02-25)
**Status**: implementing
**Started**: 2026-02-25

## Plan
- [x] Step 1: Reproduzir e confirmar quais campos da UI ainda saem como `unknown` no payload/SSOT
- [x] Step 2: Corrigir intake Autotask para resolver nome da empresa via `companyID` e persistir no SSOT canônico
- [x] Step 3: Validar no ticket real da tela + typecheck e documentar na wiki

## Open Questions
- Nenhuma para este fix. Escopo: preencher nome da empresa autoritativo (display) mantendo `company_id` já persistido.

## Progress Notes
- Confirmado no banco para `T20260225.0013`: `ticket_ssot.payload.autotask_authoritative.company_id` existe (`29690404`), mas `ticket_ssot.payload.company = 'unknown'`.
- Inspeção do payload real do Autotask confirmou que `Tickets` retorna `companyID`, mas não retorna nome da empresa no próprio ticket (somente IDs), então é necessário lookup adicional em `Companies`.
- `AutotaskClient` ganhou `getCompany(companyId)` e o `PrepareContext` agora resolve `ticket.company` via `companyID` quando o nome vem vazio/unknown no ticket.
- `ticket_ssot.autotask_authoritative` agora inclui `company_name` e a API/lista priorizam esse valor para display (`company/org`) quando presente.
- Verificação runtime (ticket real da tela): log `Resolved Autotask company 29690404: CAT Resources, LLC`; `ticket_ssot.company` e `autotask_authoritative.company_name` persistidos como `CAT Resources, LLC`.
- Verificação sidebar (`/email-ingestion/list`): `T20260225.0013` agora retorna `company/org = CAT Resources, LLC`.
- Verificação: `pnpm --filter @playbook-brain/api typecheck` OK.

## Review
(fill in after completion)
- What worked: reproduzir direto no ticket da tela + inspecionar shape real do ticket Autotask evitou suposições sobre campos inexistentes no endpoint `Tickets`.
- What was tricky: `Tickets` traz `companyID` mas não o nome da empresa; o valor de display exige lookup adicional em `Companies`.
- Time taken: ~25 min
