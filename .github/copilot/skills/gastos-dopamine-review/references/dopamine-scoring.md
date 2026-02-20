# Dopamine Scoring (priorizacao)

Pontue cada opcao de 1 a 5 (5 = melhor), e calcule o score total.

## Impacto (1-5)
- Aumenta clareza/controle e gera microvitoria frequente.
- Cria ou reforca loop diario/semanal.

## Esforco (1-5, invertido)
- 5 = muito facil (mudanca pequena e localizada)
- 1 = grande rework ou dependencias novas

## Risco (1-5, invertido)
- 5 = risco baixo (nao mexe em dinheiro, nao muda engine, nao aumenta privacidade)
- 1 = risco alto (mexe em calculo, notificacoes sensiveis, dados novos)

## Superficie (1-5)
- 5 = widget/home (alta exposicao)
- 3 = panorama/budgets
- 1 = telas raras

## Score sugerido
Score = Impacto + Esforco + Risco + Superficie

## Gate de etica
Se a opcao viola guardrails (cassino, culpa, pay-to-keep-streak), rejeitar.
