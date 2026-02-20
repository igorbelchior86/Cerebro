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
