# Severidade (P0 / P1 / P2)

## P0 — Bloqueia merge
- Crash provável ou confirmado
- Corrupção/perda de dados do usuário
- Falha de segurança/privacidade
- Quebra de arquitetura (ex.: vendor SDK em UI, ciclos, DI quebrada)
- Regressão funcional em fluxo crítico (home, add transaction, budgets, sync, settings)

## P1 — Deve corrigir antes de merge
- Bug possível em edge case importante
- Performance regressiva perceptível
- Concorrência inconsistente (MainActor/Task/cancelamento) com risco real
- Dívida técnica criada sem justificativa (ex.: lógica pesada no body)

## P2 — Melhoria / follow-up
- Nits de legibilidade
- Melhorias de testes
- Pequena simplificação/refactor seguro
