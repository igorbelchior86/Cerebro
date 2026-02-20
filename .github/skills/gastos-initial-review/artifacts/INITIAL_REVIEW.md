# INITIAL REVIEW (Gastos+)

> Gerado por: gastos-initial-review

## 1) Resumo executivo (10 linhas)
O Gastos+ é um app de finanças pessoais bem estruturado com arquitetura em pacotes Swift modular. Apresenta separação clara de responsabilidades entre UI (GastosSwiftUI), App Logic (GastosApp), Domain (GastosCore), Data (GastosData), e Design (GastosDesign). O código demonstra boas práticas de DI com AppContainer e uso de async/await. Principais preocupações: uso extensivo de DispatchQueue misturado com async/await, excesso de prints/debugPrints em produção, e potencial sobrecarga computacional no body do ContentView. A arquitetura segue direções de dependência adequadas, mas precisa de limpeza em logging e padronização de concorrência.

**Principais forças**: Boundaries bem definidos, DI explícito via container, uso consistente de async/await, testes presentes em pacotes críticos (Core, Design, App, JSBridge).

**Principais riscos**: Uso extensivo de `DispatchQueue` para workarounds de timing de UI (26 ocorrências), `print()` statements fora de `#if DEBUG` (potencial vazamento de dados), falta de cancelamento explícito em Tasks de longa duração, e computações pesadas potencialmente executadas no SwiftUI `body` via closures. O app tem 3600+ linhas em `ContentView.swift`, indicando oportunidade de refatoração.

**Recomendação**: Priorizar P0/P1 issues (concorrência, logging, performance), estabelecer PR gates para imports proibidos e logs, e considerar split de `ContentView` em componentes menores.

## 2) Boundary map (observado)
- Entrypoints UI: `GastosSwiftUIApp.@main`, `ContentView` (root view), `AppShellView`
- Entrypoints Widget (se existir): `GastosWidgetBundle.swift`, `BalanceTodayWidget.swift`, `ActiveBudgetsWidget.swift`
- Targets/pacotes e responsabilidades:
  - `GastosSwiftUI`: UI layer, Views, ViewModels, navigation
  - `GastosApp`: Application logic, Stores (Transactions, Cards, Budgets, etc.), ViewModels, DI container
  - `GastosCore`: Domain models, business logic, calculations, utilities (sem dependências externas)
  - `GastosData`: Data persistence, Firebase integration, auth, repositories, sync
  - `GastosDesign`: UI components, design tokens, styling utilities
  - `GastosSync`: Synchronization logic (separado)
  - `GastosJSBridge`: JavaScript bridge functionality
- Composition root / DI: `AppContainer` em `GastosSwiftUIApp.init()`, factories para stores e serviços
- Integrações externas: Firebase (Auth, Database, Messaging), Google Sign-In, APNs, Widgets

## 3) Top 15 issues (P0/P1/P2)
> Cada item: **Severidade**, **Arquivo(s)/Símbolo(s)**, **Motivo**, **Impacto**, **Correção**, **Teste/Validação**

1. **P0**, **GastosSwiftUI/GastosSwiftUIApp.swift:88-111**, **print/debugPrint statements em produção**, **Logs sensíveis podem expor dados do usuário em production builds**, **Remover prints ou envolver em #if DEBUG**, **Testar app em release build e verificar ausência de logs**

2. **P1**, **Multiple files (46 matches)**, **Uso misto de DispatchQueue com async/await**, **Inconsistência de concorrência pode causar race conditions e deadlocks**, **Padronizar em async/await com MainActor para UI, criar adaptadores para legado**, **Testar concorrência em cenários de carga**

3. **P1**, **GastosSwiftUI/ContentView.swift (2747 lines)**, **Sobrecarga computacional no body**, **Performance regressiva e re-renders desnecessários**, **Mover lógica pesada para ViewModels, usar @State seletivo**, **Profile com Instruments, medir frame drops**

4. **P1**, **GastosData/Package.swift:18-20**, **Dependências diretas de Firebase SDK em Data layer**, **Acoplamento forte dificulta testes e substituição**, **Criar interfaces abstratas, implementar adapters**, **Testes unitários com mocks**

5. **P2**, **Multiple files (59 matches)**, **Force unwrapping (!) e try!**, **Potencial crashes em runtime**, **Usar guard let, optional chaining, proper error handling**, **Testes de edge cases com dados nil/inválidos**

6. **P2**, **GastosSwiftUI/GastosSwiftUIApp.swift:229-279**, **ViewModel factories com cache manual**, **Memory leaks e estado inconsistente**, **Implementar factory pattern com lifecycle management**, **Memory leak detection com Instruments**

7. **P2**, **GastosSwiftUI/ContentView.swift:29-46**, **Múltiplos @Bindable stores no View**, **Complexidade elevada e dificuldade de teste**, **Agrupar em container ViewModel ou usar Store pattern**, **Testes de unidade para cada store**

8. **P2**, **GastosData/Sources/GastosData/Firebase/**, **Firebase espalhado por múltiplos arquivos**, **Dificuldade de manutenção e substituição**, **Centralizar em FirebaseService/Adapter**, **Testes de integração com mock Firebase**

9. **P2**, **Multiple files**, **Ausência de tratamento de erros consistente**, **UX ruim e crashes não tratados**, **Implementar ErrorHandling protocol padronizado**, **Testes de fluxos de erro**

10. **P2**, **GastosSwiftUI/ContentView.swift:70-84**, **Múltiplos @State para tasks e cache**, **Estado complexo e difícil de debugar**, **Consolidar em state machine ou ViewModel**, **Debug de estado com breakpoints**

11. **P2**, **Packages/GastosCore/Sources/GastosCore/**, **Domain layer sem testes suficientes**, **Regressões em lógica de negócio**, **Adicionar unit tests para cálculos e validações**, **Coverage analysis, testes automatizados**

12. **P2**, **GastosSwiftUI/Components/**, **Componentes UI sem testes de UI**, **Regressões visuais**, **Implementar Snapshot tests com XCTest**, **CI com validação visual**

13. **P2**, **Multiple files**, **Strings hardcoded sem localização**, **Problemas de internacionalização**, **Externalizar strings para Localizable.strings**, **Testes com múltiplos idiomas**

14. **P2**, **GastosData/Sources/GastosData/Realtime/**, **Complexidade elevada em sync logic**, **Dificuldade de debug e manutenção**, **Dividir em smaller services, adicionar logging**, **Testes de integração de sync**

15. **P2**, **GastosSwiftUI/ViewModels/**, **ViewModels sem lifecycle management claro**, **Memory leaks e estado inconsistente**, **Implementar protocolos claros e cleanup**, **Memory profiling**

## 4) Quick wins (até 10)
- Remover todos os `print(` e `debugPrint(` fora de `#if DEBUG`
- Criar wrapper para logging com níveis (DEBUG, INFO, ERROR)
- Substituir `DispatchQueue.main.async` por `Task { @MainActor in }` onde possível
- Extrair lógica pesada do `ContentView.body` para métodos privados ou ViewModels
- Adicionar `guard let` para force unwraps críticos
- Criar protocolo `ErrorHandling` para tratamento padronizado
- Externalizar strings hardcoded para localização
- Adicionar comentários para complexidade ciclomática alta
- Criar constants para "magic numbers" em UI
- Implementar factory pattern simples para ViewModels

## 5) Riscos de regressão e como testar
- Smoke checklist (mínimo):
  - App launch
  - Home root -> month -> day (se aplicável)
  - Adicionar/editar/deletar transação (se aplicável)
  - Budgets (se aplicável)
  - Ajustes (abrir/fechar + toggles)
  - Offline banner / sync (se aplicável)
  - Widgets (se aplicável)

## 6) Recomendações de padrões (empresa grande)
- Arquitetura e boundaries: Manter estrutura atual de pacotes, adicionar Architecture Decision Records (ADRs)
- DI / Composition root: Expandir AppContainer com factory methods, usar protocolos para todas as dependências externas
- Estado e alertas: Implementar State pattern para estados complexos, centralizar alert handling
- Concorrência: Padronizar em async/await com MainActor, criar adaptadores para código legado
- Performance: Implementar cache strategies, lazy loading, e performance monitoring
- Observabilidade (logs): Implementar structured logging com níveis, remover logs sensíveis
- Testes: Exigir 80% coverage para Domain layer, integration tests para fluxos críticos

## 7) PR gates sugeridos (opcional)
- Imports proibidos por camada
- Proibir `print(` fora de DEBUG
- Alertas para `DispatchQueue` fora de adaptadores
- Heurística: trabalho pesado em SwiftUI `body`
- Exigir testes para mudanças em Domain/Core e VMs críticas
