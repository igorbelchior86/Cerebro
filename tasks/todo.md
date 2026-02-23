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

## Review
(fill in after completion)
- What worked:
- What was tricky:
- Time taken:
