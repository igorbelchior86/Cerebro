---
name: Design 03 - UI Engineer
description: Executor de correções de UI. Aplica somente os findings do Rules Auditor no código, com mudanças mínimas, rastreáveis por rule_id, sem remover funcionalidades.
execution_mode: DETERMINISTIC_LOW_TEMPERATURE (0.0 - 0.1)
---

# Design - UI Engineer

## Regra de uso (obrigatória)
- Esta skill deve ser usada sempre por invocação da skill (IDE/CLI).
- O input oficial é `AUDIT_FINDINGS.json` (Rules Auditor).
- Só executar findings com status `fail` ou `warning`. `pass` e `insufficient_data` NÃO geram mudanças.
- Mudanças devem ser mínimas e rastreáveis: cada alteração deve referenciar um `rule_id`.
- Funcionalidades nunca devem ser removidas.
- Se um finding não puder ser aplicado sem risco (ex.: falta de contexto), registrar como `blocked` no relatório com o motivo.

## Objetivo
Transformar `AUDIT_FINDINGS.json` em alterações concretas no código com o menor delta possível, preservando comportamento.

## Entradas
Obrigatório:
- `artifacts/AUDIT_FINDINGS.json`

Opcional (recomendado):
- Código do repo disponível localmente no mesmo workspace
- Contexto do framework (SwiftUI / UIKit / Web etc.)

## Saídas (obrigatórias)
- `artifacts/IMPLEMENTATION_REPORT.md`
- `artifacts/CHANGELOG.md`

Se houver alterações em código:
- Liste arquivos alterados e o motivo (por rule_id).
- Inclua um plano de teste rápido por mudança.

## Workflow
1) Preparar inputs
- Executar `scripts/prepare_ui_engineer_inputs.sh` (read-only) para capturar:
  - status do git
  - arquivos candidatos (via code search hints)
  - árvore do projeto
2) Carregar `AUDIT_FINDINGS.json`
3) Para cada finding (fail/warning), em ordem:
- Confirmar no código se o problema existe (evita falso positivo)
- Localizar o ponto mínimo para corrigir
- Aplicar ajuste de acordo com a recomendação do finding
- Registrar no CHANGELOG (rule_id, arquivo, mudança)
4) Gerar IMPLEMENTATION_REPORT.md
- Resumo do que foi aplicado, o que foi bloqueado, e como testar

## Padrão de execução por tipo de regra (heurístico)
- TYP-* : ajustar estilos tipográficos centralizados antes de alterar views individuais.
- SPC-* : padronizar tokens/constantes (spacing) antes de ajustar valores locais.
- LAY-* : corrigir alinhamento e grid por container (Stacks/Grids) com mínimo impacto.
- COL-* : migrar cores para assets/tokens; reduzir variações com opacidade.
- CTA-* : tornar 1 CTA primário; rebaixar o resto sem remover ação.

## Critérios de sucesso
- Nenhuma funcionalidade removida.
- Diferença mínima no código.
- Cada mudança mapeada a um rule_id.
- Relatório claro: aplicado vs bloqueado, com testes.
