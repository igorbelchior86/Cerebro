# INITIAL REVIEW (Gastos+)

> Gerado por: gastos-initial-review

## 1) Resumo executivo (10 linhas)
- 

## 2) Boundary map (observado)
- Entrypoints UI:
- Entrypoints Widget (se existir):
- Targets/pacotes e responsabilidades:
- Composition root / DI:
- Integrações externas:

## 3) Conformidade Regulatória (P0.3 / Technical Authority)
- **Sacred Zone (Core Logic)**: [STATUS: OK/FAIL] - Evidência:
- **Design System (Liquid Glass)**: [STATUS: OK/FAIL] - Evidência:
- **Data Governance (dataUid/cents)**: [STATUS: OK/FAIL] - Evidência:

## 4) Top 15 issues (P0/P1/P2)
> Cada item: **Severidade**, **Arquivo(s)/Símbolo(s)**, **Motivo**, **Impacto**, **Correção**, **Teste/Validação**

1. 
2. 
3. 

## 5) Quick wins (até 10)
- 

## 6) Riscos de regressão e como testar
- Smoke checklist (mínimo):
  - App launch
  - Home root -> month -> day (se aplicável)
  - Adicionar/editar/deletar transação (se aplicável)
  - Budgets (se aplicável)
  - Ajustes (abrir/fechar + toggles)
  - Offline banner / sync (se aplicável)
  - Widgets (se aplicável)

## 7) Recomendações de padrões (empresa grande)
- Arquitetura e boundaries:
- DI / Composition root:
- Estado e alertas:
- Concorrência:
- Performance:
- Observabilidade (logs):
- Testes:

## 8) PR gates sugeridos (opcional)
- Imports proibidos por camada
- Proibir `print(` fora de DEBUG
- Alertas para `DispatchQueue` fora de adaptadores
- Heurística: trabalho pesado em SwiftUI `body`
- Exigir testes para mudanças em Domain/Core e VMs críticas
