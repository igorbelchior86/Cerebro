# Audit Checklist (Enterprise)

## Arquitetura / Boundaries
- Dependências unidirecionais? Há ciclos?
- Vendor SDK restrito ao módulo correto? (Ex: Firebase em GastosData/Sync apenas)
- UI usa componentes de `GastosDesign` vs modificadores ad-hoc?

## Sacred Zone (P0.3)
- Integridade de `UnifiedBalanceEngine.swift` e `BudgetEngine.swift`?
- Integridade de `AppBootstrapRepository.swift` e `AppStore.swift`?
- Integridade de `RecurrenceExpander.swift`?

## Design System (Liquid Glass)
- Uso de `LiquidGlassBackdrop` e `ModalSheetHeader` em todas as sheets?
- Uso de `SheetPrimaryButtonStyle` (#252525) para ações principais?
- Ausência de `.material` ad-hoc ou cores de borda fora dos tokens?

## DI / Composition root
- Há container/factories claros?
- Services são construídos em Views? (anti-pattern - PROIBIDO)
- Dependências são explícitas no init?

## Estado e Governança de Dados
- Uso correto de `dataUid` e `profileId` em todos os caminhos de RTDB?
- Arredondamento e Minor Units (cents) consistentes?
- Paridade de lógica com GastosWeb (Section E3)?

## Concorrência
- async/await consistente e isolamento via MainActor?
- Uso de `SyncLogger` e `CDLog` para telemetria de erros?

## Performance
- Trabalho pesado no SwiftUI `body` ou agregadores pesados sem cache?

## Segurança/Privacidade
- Logs com dados sensíveis?
- Tokens/chaves fora do código?

## Testes
- Golden Tests executando e passando para Core Logic (E2.1)?
- Domain/Core com unit tests?

