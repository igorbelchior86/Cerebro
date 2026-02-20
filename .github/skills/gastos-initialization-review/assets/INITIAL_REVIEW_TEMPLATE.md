# INITIAL REVIEW (Initialization)

> Gerado por: gastos-initialization-review

## 1) Resumo executivo (10 linhas)
-

## 2) Linha do tempo do startup (observado/provável)
- Cold start:
- Warm start:
- Resume:

## 3) Entrypoints e wiring
- App entrypoint(s):
- Primeira tela (first render):
- Composition root / DI:
- Vendors/SDKs no caminho crítico:

## 4) Top 15 issues (P0/P1/P2)
> Cada item: **Severidade**, **Cold/Warm/Resume**, **Arquivo(s)/Símbolo(s)**, **Motivo**, **Impacto**, **Correção**, **Validação**
1.
2.
3.

## 5) Quick wins (até 10)
-

## 6) Hipóteses e como medir (sem Instruments)
- Hipótese:
  - Evidência (código):
  - Medida sugerida (timestamps/log temporário/signpost):
  - Esperado após fix:

## 7) Riscos de regressão e como testar
### Smoke checklist (mínimo)
- [ ] Cold start: force quit -> abrir app -> chegar na home
- [ ] Warm start: alternar apps e voltar (sem matar processo)
- [ ] Resume: background > voltar (validar triggers)
- [ ] Navegação crítica tocada: home -> month -> day (se aplicável)
- [ ] Ações críticas tocadas pelo startup (listar)
- [ ] Offline/online (se aplicável)
- [ ] Widgets (se aplicável): build + refresh

## 8) Recomendações de padrões (startup hardening)
- SwiftUI lifecycle (guards, idempotência, cancelamento):
- ViewModel init vs task:
- Concurrency (MainActor, cancellation):
- Performance (first render, lazy loading, caches):
- Vendors/SDK init:
