# Severidade (P0 / P1 / P2)

## P0 — Bloqueia merge / risco crítico
- Crash provável/confirmado
- Corrupção/perda de dados do usuário
- Falha de segurança/privacidade
- Quebra de arquitetura (vendor SDK em UI, ciclos, back-edges)
- Regressão em fluxo crítico (home, add transaction, budgets, sync, settings)

## P1 — Deve corrigir
- Bug possível em edge case importante
- Performance regressiva perceptível
- Concorrência inconsistente com risco real (MainActor/cancelamento)
- Dívida técnica nova sem justificativa (ex.: lógica pesada em `body`)

## P2 — Follow-up
- Legibilidade, pequenas simplificações
- Melhorias de testes e documentação
