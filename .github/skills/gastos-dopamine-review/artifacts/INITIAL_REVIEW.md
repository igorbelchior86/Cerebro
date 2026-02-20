# INITIAL REVIEW (Gastos+)

> Gerado por: gastos-dopamine-review
> Data: 2026-01-18

## 1) Resumo executivo (10 linhas)

Gastos+ é um aplicativo de finanças pessoais iOS construído com SwiftUI, Firebase RTDB e arquitetura modular em Swift Packages. O projeto apresenta **maturidade arquitetural sólida** com separação clara de camadas (Core/Data/Design/App), motor de cálculo robusto (`UnifiedBalanceEngine`), e sistema de widgets completo. Pontos fortes incluem: tipagem forte com modelos imutáveis, cache local com CRC32, offline queue com replay automático, e Golden Tests para zona sagrada. Principais gaps: algumas Views com lógica complexa no body, falta de instrumentação de métricas de produto, e oportunidades de gamificação não exploradas. O sistema de streak existe mas está subaproveitado na UI. A base de código está pronta para evolução dopaminérgica com investimento moderado.

---

## 2) Boundary map (observado)

### Entrypoints UI:

- **App Root**: `GastosSwiftUIApp.swift` (`@main`, setup Firebase, DeepLink handling)
- **Main Content**: `ContentView.swift` (TabView, orchestration, widget sync)
- **Home**: `HomeTabRoot.swift` (month grid, day grid, financial gauge)
- **Panorama**: `PanoramaView.swift` (budgets, scheduled, snapshots)
- **Planned**: `PlannedInlineView.swift` (calendar, upcoming transactions)

### Entrypoints Widget:

- `GastosWidgetBundle.swift` (bundle de todos os widgets)
- `GastosWidget.swift` (widget principal legacy)
- `CashflowWidget.swift` (cashflow 7 dias)
- `BalanceTodayWidget.swift` (saldo do dia)
- `ActiveBudgetsWidget.swift` (orçamentos ativos)
- `CommitmentsWidget.swift` (compromissos futuros)

### Targets/pacotes e responsabilidades:

| Package          | Responsabilidade                                                  | Dependências       |
| ---------------- | ----------------------------------------------------------------- | ------------------ |
| `GastosCore`     | Domain Models, Balance Engine, Budget Engine, Recurrence Expander | Nenhuma            |
| `GastosData`     | Firebase RTDB, REST Client, Notifications, DTOs, Realtime Sync    | GastosCore         |
| `GastosDesign`   | UI Components, Tokens, HapticFeedback, Cards, Rows                | Nenhuma            |
| `GastosApp`      | Stores, Services, ViewModels, Offline Queue, Widget Sync          | Core, Data, Design |
| `GastosJSBridge` | JSCore para paridade com regras Web                               | GastosCore         |
| `GastosSync`     | Placeholder para CloudKit (não implementado)                      | -                  |

### Composition root / DI:

- `AppController` em `GastosSwiftUIApp.swift` (singleton-like)
- `AppContainer` em `GastosApp` (factory pattern)
- `BootstrapCoordinator` para inicialização sequenciada
- Stores injetados via `@Environment` e passados explicitamente

### Integrações externas:

- **Firebase Auth** (Google Sign-In)
- **Firebase RTDB** (source of truth)
- **Firebase Messaging** (push notifications)
- **TipKit** (Easter eggs)
- **WidgetKit** (5 widgets)
- **UserNotifications** (local notifications)

---

## 3) Top 15 issues (P0/P1/P2)

### P0 (Bloqueia merge / risco crítico)

_Nenhum P0 identificado._ A zona sagrada está bem protegida com Golden Tests.

---

### P1 (Deve corrigir)

**1. P1 | `HomeTabRoot.swift` | View com lógica de negócio**

- **Motivo**: Funções como `groupedTransactionsForYear`, `resolvedDayBalancesForYear` contêm lógica que deveria estar no ViewModel.
- **Impacto**: Dificulta testes unitários, re-renders desnecessários.
- **Correção**: Mover para `HomeViewModel` com propriedades computed cacheadas.
- **Teste**: Unit tests no HomeViewModel.

**2. P1 | `ContentView.swift` | Arquivo muito grande (108KB)**

- **Motivo**: 2500+ linhas, orquestra quase tudo.
- **Impacto**: Dificuldade de navegação, potencial para conflitos de merge.
- **Correção**: Extrair sub-components para arquivos separados (DeepLinkHandler, WidgetSyncOrchestrator).
- **Teste**: Smoke test de navegação.

**3. P1 | Falta de instrumentação de métricas**

- **Motivo**: Não há tracking de D1/D7 retention, tempo de sessão, conversão por widget.
- **Impacto**: Impossível medir sucesso de features.
- **Correção**: Implementar Firebase Analytics ou similar.
- **Teste**: Verificar eventos disparados via Debug View.

**4. P1 | `PanoramaView.swift` | Lógica pesada inline**

- **Motivo**: Funções como `recalculatePanoramaData` (1000+ linhas) fazem cálculos complexos.
- **Impacto**: Performance em render, dificuldade de teste.
- **Correção**: Extrair para `PanoramaViewModel` ou service.
- **Teste**: Unit tests para cálculo de métricas.

**5. P1 | Streak subaproveitado na UI**

- **Motivo**: `cachedTodayStreak` existe em `HomeViewModel` mas só aparece em `StreakBadge` pequeno.
- **Impacto**: Oportunidade de dopamina perdida.
- **Correção**: Ver DOPAMINE_AUDIT para opções.
- **Teste**: Visual inspection, TipKit integration.

---

### P2 (Follow-up)

**6. P2 | Haptics inconsistentes**

- **Motivo**: Alguns locais usam `HapticFeedback.light()` centralizado, outros criam `UIImpactFeedbackGenerator` inline.
- **Correção**: Padronizar em `HapticFeedback` enum.

**7. P2 | Debug logs excessivos**

- **Motivo**: `debugPrint` espalhado (PanoramaSheet, Closures).
- **Correção**: Usar `DebugLogger` com níveis.

**8. P2 | `AddOperationSheet.swift` muito grande (94KB)**

- **Motivo**: Modal com muitas funcionalidades.
- **Correção**: Extrair seções para componentes menores.

**9. P2 | Falta de testes para ViewModels UI**

- **Motivo**: Apenas `HomeViewModel` parcialmente testado via Golden Tests.
- **Correção**: Adicionar unit tests para `PlannedViewModel`, estado de navegação.

**10. P2 | TipKit apenas para Easter egg**

- **Motivo**: `GaugeDoubleTapTip` é a única tip.
- **Correção**: Expandir para onboarding dopaminérgico.

**11. P2 | Widgets sem deep linking consistente**

- **Motivo**: Alguns widgets têm `.widgetURL`, outros não.
- **Correção**: Padronizar deep links por widget.

**12. P2 | Falta de feedback visual em ações**

- **Motivo**: Algumas ações (marcar como paga, editar) não têm confirmação visual clara.
- **Correção**: Implementar micro-celebrações.

**13. P2 | Cache invalidation manual**

- **Motivo**: `yearViewCache.setDailyBudgetLookup` chamado explicitamente.
- **Correção**: Considerar Combine/AsyncStream para invalidação reativa.

**14. P2 | Concorrência com actors parcial**

- **Motivo**: `RealtimeState` recém convertido para actor, mas outros stores usam `@MainActor`.
- **Correção**: Revisão de thread safety em stores.

**15. P2 | Falta de rate limiting em widget sync**

- **Motivo**: `enqueueWidgetSync` pode ser chamado frequentemente.
- **Correção**: Debounce já existe, mas validar eficácia.

---

## 4) Quick wins (até 10)

1. **Unificar haptics**: Substituir `UIImpactFeedbackGenerator` inline por `HapticFeedback` enum. (~1h)
2. **Adicionar micro-celebração em "transação salva"**: Haptic + checkmark animado. (~2h)
3. **Streak visível no widget**: Adicionar streak ao `ActiveBudgetsWidget`. (~2h)
4. **TipKit para "fechar o dia"**: Nova tip quando usuário volta no fim do dia. (~3h)
5. **Remover debug prints**: Limpar ou migrar para `DebugLogger`. (~1h)
6. **Deep link para todos widgets**: Padronizar `.widgetURL`. (~2h)
7. **Loading skeleton para gauge**: Evitar "0,00" inicial. (~1h)
8. **Contador de dias fechados no mês**: Adicionar ao `FinancialSummaryWidget`. (~3h)
9. **Notificação de fechamento diário**: Implementar trigger às 21h. (~3h)
10. **Badge de "primeiro dia verde"**: Celebrar milestone inicial. (~2h)

---

## 5) Riscos de regressão e como testar

### Smoke checklist (mínimo):

- [ ] **App launch**: Iniciar app cold start, verificar logo → home transition
- [ ] **Home root → month → day**: Tap em mês → expande → tap em dia → DayDetailView
- [ ] **Adicionar/editar/deletar transação**: AddOperationSheet → preencher → salvar → verificar lista
- [ ] **Budgets**: Panorama → criar budget → verificar card → deletar
- [ ] **Ajustes**: Settings → toggles de notificação → fechar → verificar persistência
- [ ] **Offline banner / sync**: Desligar internet → adicionar transação → religar → sync automático
- [ ] **Widgets**: Adicionar widget → verificar dados → tap → deep link funcional
- [ ] **Notificações**: Simular notificação de transação compartilhada → tap → navegação correta

---

## 6) Recomendações de padrões (empresa grande)

### Arquitetura e boundaries:

- ✅ Unidirecional (UI → App → Core → Data)
- ⚠️ Algumas Views com lógica (migrar para VMs)
- ✅ Firebase SDK isolado em `GastosData`

### DI / Composition root:

- ✅ Factory pattern presente
- ⚠️ Algumas Views instanciam services diretamente
- Recomendação: Considerar `@Environment` para services

### Estado e alertas:

- ✅ `@Observable` stores
- ✅ Toast system centralizado
- ⚠️ Boolean soup em alguns lugares (ex: `isFinancialWidgetMinimized`)

### Concorrência:

- ✅ async/await consistente
- ✅ `@MainActor` em ViewModels
- ⚠️ Transição para actors em andamento

### Performance:

- ⚠️ Lógica de cálculo em SwiftUI body (PanoramaView, HomeTabRoot)
- ✅ Caches com versioning
- ✅ LazyHStack/VStack para listas longas

### Observabilidade (logs):

- ⚠️ `debugPrint` excessivo
- ✅ `DebugLogger` disponível mas subaproveitado
- Recomendação: Implementar níveis (verbose, info, error)

### Testes:

- ✅ Golden Tests para Domain/Core (UnifiedBalanceEngine)
- ✅ Unit tests para sanitização e recorrência
- ⚠️ Falta cobertura de VMs e Views
- Recomendação: Snapshot UI tests para componentes críticos

---

## 7) PR gates sugeridos (opcional)

```yaml
# .github/workflows/pr-gates.yml
- name: Forbidden Imports Check
  run: |
    # UI não pode importar Firebase diretamente
    ! grep -r "import Firebase" GastosSwiftUI/ --include="*.swift"

- name: No Print in Production
  run: |
    # print() só permitido com #if DEBUG
    ! grep -rn "^[^/]*print(" --include="*.swift" Packages/ GastosSwiftUI/

- name: Heavy Body Check
  run: |
    # Alerta para bodies > 50 linhas
    # (heurística simples, idealmente SwiftLint custom rule)

- name: Golden Tests Required
  run: |
    swift test --filter "Golden"

- name: Domain Tests Required
  run: |
    swift test --filter "GastosCoreTests"
```

---

## Anexos

### Arquivos críticos da Zona Sagrada (não modificar sem Golden Tests):

| Arquivo                      | Responsabilidade                 |
| ---------------------------- | -------------------------------- |
| `UnifiedBalanceEngine.swift` | Cálculo de saldo diário e streak |
| `BudgetEngine.swift`         | Lógica de orçamentos e reservas  |
| `RecurrenceExpander.swift`   | Expansão de recorrências         |
| `AppStore.swift`             | `startDate`, `startBalanceMinor` |
| `DTOs/`                      | Transformação Firebase → Domain  |

---

_Revisão completa. Ver DOPAMINE_AUDIT.md para oportunidades de gamificação._
