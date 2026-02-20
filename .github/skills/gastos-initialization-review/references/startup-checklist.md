# Startup Checklist (Cold / Warm / Resume)

## Caminho crítico (First Render)
- Trabalho pesado no main thread antes da primeira tela?
- Primeira tela faz agregações no `body`?
- Decoding/IO grande em init/onAppear?

## SwiftUI lifecycle
- `.task`/`onAppear` idempotentes?
- Guard contra reexecução em resume?
- Cancelamento quando navega rápido?
- Observers duplicam ao voltar do background?

## Dependências / Vendors
- Vendor SDK init no cold start? É necessário?
- Sync/network disparado no cold start sem necessidade?
- Fallback offline sem travar UI?

## Dados
- Cache evita recomputação no startup?
- Migrações/decoders otimizados para primeiro-run?

## Governança & Sacred Zone (P0.3)
- Integridade de `AppStore.swift` e `AppBootstrapRepository.swift`?
- Governança de `dataUid` aplicada no primeiro fetch/scan?
- Paridade de lógica em `computeDailyBalances` (E2.1/E3)?
- Uso de `SyncLogger` e `CDLog` para erros de inicialização (E3)?

## Medição
- Pontos de medição (SyncLogger/CDLog) para confirmar hipótese?
- Como comparar antes/depois?
