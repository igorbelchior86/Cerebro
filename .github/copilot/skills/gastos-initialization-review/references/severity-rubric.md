# Severidade (P0 / P1 / P2) — Startup

## P0 — Bloqueia
- UI travada no cold start (main thread bloqueado)
- Crash no caminho crítico
- Loop/reentrância repetitiva degradando UX/bateria
- Corrupção de estado em resume (race)

## P1 — Deve corrigir
- Jank perceptível no first render ou ao retomar
- Inicialização desnecessária no cold start (IO/network) que pode ser lazy
- Falta de cancelamento/guard em `.task`/observers causando duplicação

## P2 — Follow-up
- Refactors de clareza/organização
- Instrumentação recomendada
- Otimizações pequenas
