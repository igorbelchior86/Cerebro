# DOPAMINE_AUDIT (Gastos+)

> Gerado por: gastos-dopamine-review
> Data: 2026-01-18

## 1) Resumo executivo

O Gastos+ possui **infraestrutura técnica sólida para dopamina** (streak engine, haptics centralizados, widgets, notificações), mas **subexplora o potencial de hábito**. O gauge financeiro é o melhor elemento dopaminérgico atual - visual, instantâneo, emocional.

**Maiores oportunidades:**

1. **Loop de fechamento diário** - não existe ritual de "dia fechado"
2. **Streak com identidade** - existe cálculo, falta celebração e narrativa
3. **Widgets como triggers** - 5 widgets, mas sem call-to-action claro
4. **Notificações de vitória** - só alertas de problema, nunca de sucesso

**Risco ético baixo** - o app é orientado a controle/clareza, não a ansiedade. A gamificação deve reforçar progresso, não culpa.

---

## 2) Superfícies mapeadas (com evidência)

### Home:

- **Gauge financeiro**: `FinancialSummaryWidget.swift` - semicírculo com income/expense ratio
- **Streak badge**: `StreakBadge` em `ContentView.swift:712-714` - exibe `cachedTodayStreak`
- **Month grid**: `YearGridContentView.swift` - grade de meses com cores
- **TipKit Easter egg**: `GaugeDoubleTapTip.swift` - double tap no gauge

### Widgets:

- `GastosWidget.swift` - widget legacy
- `CashflowWidget.swift` - cashflow 7 dias
- `BalanceTodayWidget.swift` - saldo do dia com cores
- `ActiveBudgetsWidget.swift` - budgets ativos com streak (linha 555-561)
- `CommitmentsWidget.swift` - próximos compromissos

### Notificações:

- `NotificationManager.swift` (GastosData) - scheduling completo
- `PushCoordinator.swift` - deep linking de push
- Tipos: transações esquecidas, budgets, convites, lembretes
- **Falta**: celebrações, fechamento diário, vitórias

### Panorama/Budgets:

- `PanoramaView.swift` - budgets ativos e agendados
- `BudgetCardView.swift` - cards com status visual (ok/warning/danger)
- `ClosedCycleRow` - histórico de ciclos fechados
- `ScheduledBudgetRow` - orçamentos agendados

### Transações (incl. agendadas):

- `PlannedInlineView.swift` - lista de compromissos
- `AddOperationSheet.swift` - modal de criação
- `TransactionCardView.swift` - card de transação
- Status: `PaidStatus.planned` / `PaidStatus.paid`

### OCR/Receipts:

- **Não implementado** atualmente

---

## 3) Touchpoints dopaminérgicos já existentes

### Closure diário:

- ❌ **Não existe ritual de fechamento explícito**
- Existe cálculo de streak mas sem "carimbo" visual de dia fechado

### Streak:

- ✅ **Engine completa**: `UnifiedBalanceEngine.swift:458-475`
  - Streak incrementa quando saldo ≥ 0
  - Chain propagation entre anos
- ✅ **Cache no ViewModel**: `HomeViewModel.cachedTodayStreak`
- ⚠️ **UI mínima**: `StreakBadge` pequeno no header
- ⚠️ **Widget parcial**: `ActiveBudgetsWidget` mostra streak (linha 555)

### Microcelebração/haptic:

- ✅ **Centralizado**: `HapticFeedback.swift` em GastosDesign
- ✅ **Tipos**: light, medium, heavy, success, warning, error, selectionChanged
- ✅ **Usado em**: toolbar (6x), cards (4x), gauge tap, accordion expand
- ⚠️ **Falta em**: salvar transação, completar planned, fechar ciclo

### Variação segura (conteúdo rotativo):

- ❌ **Não existe** - insight do dia, dicas, etc.
- Oportunidade: "Dica do dia" no gauge collapsed state

---

## 4) Pontos cegos (anti-dopamina)

### Atraso no reforço:

- ⚠️ **Ação → Resultado demora** - salvar transação não tem feedback imediato além de "toast"
- Recomendação: checkmark animado + haptic + delta visual no saldo

### Só mostra dor:

- ⚠️ **Notificações são alertas negativos** - "contas esquecidas", "orçamento estourado"
- ❌ **Nunca celebra vitória** - "você economizou X", "streak de Y dias"
- Recomendação: Balance push notifications (50% alertas, 50% vitórias)

### Instabilidade de números:

- ⚠️ **Gauge mostra 0,00 em fresh install** - corrigido parcialmente, mas ainda gera ansiedade inicial
- ✅ **Engine é estável** - `UnifiedBalanceEngine` produz resultados consistentes

### Ausência de fechamento diário:

- ❌ **Nenhum ritual de "dia fechado"**
- O usuário não sabe se "fez a coisa certa hoje"
- Recomendação: Widget/notification às 21h + carimbo visual no grid

### Novidade inexistente:

- ❌ **App sempre igual** - sem insights rotativos, sem variação
- Recomendação: Conteúdo dinâmico no gauge collapsed state

### Falta de identidade:

- ⚠️ **Quem é o usuário?** - não há persona, avatar, ou progressão
- Recomendação leve: "Você é um guardião das finanças" após X dias

### Falta de investimento crescente:

- ⚠️ **Nada fica "construído"** - histórico existe mas não é celebrado
- `ClosedCycleRow` mostra ciclos mas sem gamificação
- Recomendação: "Você fechou 12 meses sem estourar" badge

---

## 5) Top 15 opções dopaminérgicas (priorizadas)

### Opção 1: Fechamento Diário ("Dia OK")

| Aspecto               | Detalhe                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Loop**              | Trigger: 21h notification / Widget tap → Ação: Ver resumo do dia → Recompensa: "Dia OK ✅" badge + haptic → Investimento: streak incrementa |
| **Superfície**        | Home (gauge footer), Widget (BalanceToday), Notification                                                                                    |
| **Âncora técnica**    | `HomeViewModel.swift`, `NotificationManager.swift`, `BalanceTodayWidget.swift`                                                              |
| **Dados necessários** | `resolvedDayBalances[today]`, transações do dia                                                                                             |
| **Riscos**            | Baixo - não altera cálculos, só adiciona UI                                                                                                 |
| **Guardrails**        | Nunca culpar por dia "não OK", sempre mostrar ação possível                                                                                 |
| **Instrumentação**    | Evento: `day_closure_viewed`, Métrica: % dias fechados / semana                                                                             |
| **Validação**         | Smoke: notification → tap → view dia → badge aparece                                                                                        |
| **Score**             | Impacto: 5, Esforço: 4, Risco: 5, Superfície: 5 = **19/20**                                                                                 |

---

### Opção 2: Microcelebração em Transação Salva

| Aspecto               | Detalhe                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| **Loop**              | Trigger: Tap salvar → Ação: Animação + haptic → Recompensa: Checkmark + "Registrado!" → Investimento: N/A |
| **Superfície**        | AddOperationSheet                                                                                         |
| **Âncora técnica**    | `AddOperationSheet.swift:2149-2154` (já tem haptic, falta animação)                                       |
| **Dados necessários** | Nenhum adicional                                                                                          |
| **Riscos**            | Zero - apenas UI polish                                                                                   |
| **Instrumentação**    | Evento: `transaction_saved`, já pode existir                                                              |
| **Validação**         | Manual: adicionar transação → ver animação                                                                |
| **Score**             | Impacto: 4, Esforço: 5, Risco: 5, Superfície: 3 = **17/20**                                               |

---

### Opção 3: Streak Celebrado ("X dias no verde")

| Aspecto               | Detalhe                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Loop**              | Trigger: Abrir app com streak > 0 → Ação: Expandir gauge → Recompensa: Badge com dias + emoji → Investimento: Manter streak |
| **Superfície**        | Home gauge area                                                                                                             |
| **Âncora técnica**    | `HomeViewModel.streakClassification`, `FinancialSummaryWidget.swift`                                                        |
| **Dados necessários** | `cachedTodayStreak` já existe                                                                                               |
| **Riscos**            | Baixo - classificação já implementada (linha 391-407)                                                                       |
| **Instrumentação**    | Evento: `streak_milestone_reached`, Métrica: streak médio                                                                   |
| **Validação**         | Golden test: verificar classificação de streak                                                                              |
| **Score**             | Impacto: 5, Esforço: 4, Risco: 5, Superfície: 5 = **19/20**                                                                 |

---

### Opção 4: Notificação de Vitória ("Você economizou!")

| Aspecto               | Detalhe                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Loop**              | Trigger: Budget fecha com sobra → Ação: Tap notification → Recompensa: Ver economia + celebração → Investimento: Definir novo limite |
| **Superfície**        | Notification, Panorama                                                                                                               |
| **Âncora técnica**    | `NotificationManager.swift`, `BudgetCycleClosureService.swift`                                                                       |
| **Dados necessários** | `BudgetCycleSnapshot.varianceMinor` (já existe)                                                                                      |
| **Riscos**            | Médio - precisa trigger no fechamento de ciclo                                                                                       |
| **Guardrails**        | Só notificar economia > X% do limite (evitar spam)                                                                                   |
| **Instrumentação**    | Evento: `budget_surplus_notification`                                                                                                |
| **Validação**         | Manual: forçar fechamento de ciclo com sobra → receber notification                                                                  |
| **Score**             | Impacto: 5, Esforço: 3, Risco: 4, Superfície: 4 = **16/20**                                                                          |

---

### Opção 5: Widget com Call-to-Action Claro

| Aspecto               | Detalhe                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------- |
| **Loop**              | Trigger: Ver widget → Ação: Saber o que fazer → Recompensa: Clareza → Investimento: Tap → App |
| **Superfície**        | Todos os widgets                                                                              |
| **Âncora técnica**    | `*Widget.swift` files                                                                         |
| **Dados necessários** | Contextual - próximo compromisso, budget mais pressionado                                     |
| **Riscos**            | Baixo - apenas copy e design                                                                  |
| **Instrumentação**    | Evento: `widget_tap`, dimension: widget_type                                                  |
| **Validação**         | Visual: comparar antes/depois                                                                 |
| **Score**             | Impacto: 4, Esforço: 4, Risco: 5, Superfície: 5 = **18/20**                                   |

---

### Opção 6: TipKit Onboarding Progressivo

| Aspecto            | Detalhe                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Loop**           | Trigger: Primeira vez em tela X → Ação: Ver tip → Recompensa: Aprender feature → Investimento: Usar feature |
| **Superfície**     | Home, Panorama, Planned                                                                                     |
| **Âncora técnica** | `TipKit`, já integrado para `GaugeDoubleTapTip`                                                             |
| **Riscos**         | Baixo - TipKit handles frequency                                                                            |
| **Instrumentação** | Evento: `tip_shown`, `tip_dismissed`                                                                        |
| **Validação**      | Reset TipKit → ver tips em sequência                                                                        |
| **Score**          | Impacto: 3, Esforço: 4, Risco: 5, Superfície: 4 = **16/20**                                                 |

---

### Opção 7: Insight Rotativo no Gauge

| Aspecto               | Detalhe                                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Loop**              | Trigger: Expandir gauge → Ação: Ver insight diferente cada dia → Recompensa: Curiosidade satisfeita → Investimento: Voltar amanhã |
| **Superfície**        | FinancialSummaryWidget                                                                                                            |
| **Âncora técnica**    | `FinancialSummaryWidget.swift`, novo componente                                                                                   |
| **Dados necessários** | Calculados: maior gasto do mês, categoria top, comparativo                                                                        |
| **Riscos**            | Médio - precisa lógica de seleção de insight                                                                                      |
| **Guardrails**        | Nunca mostrar insight que gere culpa                                                                                              |
| **Instrumentação**    | Evento: `insight_shown`, dimension: insight_type                                                                                  |
| **Validação**         | Smoke: 7 dias → 7 insights diferentes                                                                                             |
| **Score**             | Impacto: 4, Esforço: 2, Risco: 4, Superfície: 5 = **15/20**                                                                       |

---

### Opção 8: Badge de Milestone ("Primeiro mês!")

| Aspecto               | Detalhe                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Loop**              | Trigger: Completar milestone → Ação: Ver badge → Recompensa: Reconhecimento → Investimento: Buscar próximo |
| **Superfície**        | Home header, Settings (coleção)                                                                            |
| **Âncora técnica**    | Novo: `AchievementsStore`, `BadgeView`                                                                     |
| **Dados necessários** | Datas de uso, contadores de ciclos fechados                                                                |
| **Riscos**            | Médio - novo sistema                                                                                       |
| **Guardrails**        | Badges por comportamento (fechar dia), não por "gastar menos"                                              |
| **Instrumentação**    | Evento: `badge_earned`                                                                                     |
| **Validação**         | Unit test: trigger milestone → badge aparece                                                               |
| **Score**             | Impacto: 4, Esforço: 2, Risco: 4, Superfície: 4 = **14/20**                                                |

---

### Opção 9: Completo Visual em Planned

| Aspecto            | Detalhe                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **Loop**           | Trigger: Marcar como pago → Ação: Swipe/tap → Recompensa: Checkmark + riscar item → Investimento: Ver lista diminuir |
| **Superfície**     | PlannedInlineView                                                                                                    |
| **Âncora técnica** | `PlannedInlineView.swift`, `PlannedViewModel.swift`                                                                  |
| **Riscos**         | Baixo - apenas animação                                                                                              |
| **Instrumentação** | Evento: `planned_completed`                                                                                          |
| **Validação**      | Manual: completar 3 itens → animações visíveis                                                                       |
| **Score**          | Impacto: 4, Esforço: 4, Risco: 5, Superfície: 3 = **16/20**                                                          |

---

### Opção 10: Comparativo Mensal ("vs. mês passado")

| Aspecto            | Detalhe                                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Loop**           | Trigger: Início do mês → Ação: Ver comparativo → Recompensa: Saber se melhorou → Investimento: Manter ou ajustar |
| **Superfície**     | Home gauge, Panorama                                                                                             |
| **Âncora técnica** | `UnifiedBalanceEngine` (dados existem), UI nova                                                                  |
| **Riscos**         | Baixo - dados já calculados por mês                                                                              |
| **Guardrails**     | Mostrar tendência, não julgamento                                                                                |
| **Instrumentação** | Evento: `monthly_comparison_viewed`                                                                              |
| **Score**          | Impacto: 4, Esforço: 3, Risco: 5, Superfície: 4 = **16/20**                                                      |

---

### Opção 11: Som de Sucesso (Opcional)

| Aspecto        | Detalhe                                                     |
| -------------- | ----------------------------------------------------------- |
| **Loop**       | Trigger: Ação positiva → Recompensa: Som sutil + haptic     |
| **Superfície** | Global (settings para on/off)                               |
| **Riscos**     | Preferência pessoal - precisa toggle                        |
| **Score**      | Impacto: 2, Esforço: 4, Risco: 4, Superfície: 3 = **13/20** |

---

### Opção 12: Progresso do Mês no Header

| Aspecto            | Detalhe                                                                          |
| ------------------ | -------------------------------------------------------------------------------- |
| **Loop**           | Trigger: scroll down → Ação: Ver "17 de 31 dias" → Recompensa: Contexto temporal |
| **Superfície**     | AppHeader minimizado                                                             |
| **Âncora técnica** | `AppHeader.swift`, `DSToolbar.swift`                                             |
| **Score**          | Impacto: 3, Esforço: 4, Risco: 5, Superfície: 5 = **17/20**                      |

---

### Opção 13: "Guardar Troco" Suggestion

| Aspecto    | Detalhe                                                      |
| ---------- | ------------------------------------------------------------ |
| **Loop**   | Trigger: Economizou em budget → Sugestão: "Reservar para X?" |
| **Riscos** | Médio - precisa integração com savings feature               |
| **Score**  | Impacto: 3, Esforço: 2, Risco: 3, Superfície: 3 = **11/20**  |

---

### Opção 14: Animação de Transição do Gauge

| Aspecto            | Detalhe                                                         |
| ------------------ | --------------------------------------------------------------- |
| **Loop**           | Trigger: Nova transação → Recompensa: Needle se move suavemente |
| **Superfície**     | FinancialHealthGauge                                            |
| **Âncora técnica** | Já existe parcialmente (`animatedProgress`)                     |
| **Score**          | Impacto: 3, Esforço: 5, Risco: 5, Superfície: 5 = **18/20**     |

---

### Opção 15: Feedback de Conexão Restaurada

| Aspecto            | Detalhe                                                      |
| ------------------ | ------------------------------------------------------------ |
| **Loop**           | Trigger: Voltar online → Recompensa: "Sincronizado ✅" toast |
| **Superfície**     | Global (Toast)                                               |
| **Âncora técnica** | `ConnectivityStore`, ToastSystem                             |
| **Score**          | Impacto: 2, Esforço: 5, Risco: 5, Superfície: 3 = **15/20**  |

---

## Ranking por Score

| #   | Opção                  | Score |
| --- | ---------------------- | ----- |
| 1   | Fechamento Diário      | 19    |
| 1   | Streak Celebrado       | 19    |
| 3   | Widget CTA             | 18    |
| 3   | Animação Gauge         | 18    |
| 5   | Microcelebração Salvar | 17    |
| 5   | Progresso Header       | 17    |
| 7   | Notificação Vitória    | 16    |
| 7   | TipKit Onboarding      | 16    |
| 7   | Completo Planned       | 16    |
| 7   | Comparativo Mensal     | 16    |

---

## 6) Plano de rollout (4 semanas)

### Semana 1: Loop Diário + Microcelebrações

- [ ] Implementar "Dia OK" badge no gauge footer
- [ ] Adicionar haptic + checkmark em transação salva
- [ ] Notification de fechamento às 21h (opcional no settings)
- **KPIs**: Taxa de abertura da notification, % dias "vistos"

### Semana 2: Streak + Identidade

- [ ] Expandir StreakBadge para área maior no gauge
- [ ] Adicionar classificação textual ("Guardião", "Protetor", etc.)
- [ ] TipKit para primeira vez streak > 7
- **KPIs**: Streak médio, engajamento com badge

### Semana 3: Widgets + Vitórias

- [ ] Adicionar streak ao BalanceTodayWidget
- [ ] Implementar notification de economia em budget
- [ ] Deep links consistentes em todos widgets
- **KPIs**: Conversão widget → app, notification open rate

### Semana 4: Medir e Ajustar

- [ ] Análise de D1/D7 retention
- [ ] A/B test em notificações (alerta vs vitória)
- [ ] Refinamento baseado em feedback
- **KPIs**: Retention, session frequency, NPS

---

## 7) Instrumentação mínima recomendada

### Eventos Firebase Analytics sugeridos:

```swift
// Retention
Analytics.logEvent("app_open", parameters: ["source": "direct/widget/notification"])
Analytics.logEvent("session_end", parameters: ["duration_seconds": Int])

// Dopamine touchpoints
Analytics.logEvent("day_closure_viewed", parameters: ["status": "ok/warning/open"])
Analytics.logEvent("streak_milestone", parameters: ["days": Int, "classification": String])
Analytics.logEvent("transaction_saved", parameters: ["type": "income/expense", "is_planned": Bool])
Analytics.logEvent("budget_surplus_notification_shown", parameters: ["surplus_percent": Double])

// Widget engagement
Analytics.logEvent("widget_tap", parameters: ["widget_type": String])
Analytics.logEvent("widget_added", parameters: ["widget_type": String])

// Notification engagement
Analytics.logEvent("notification_opened", parameters: ["notification_type": String])
```

### Métricas de sucesso:

| Métrica                | Baseline | Target |
| ---------------------- | -------- | ------ |
| D1 Retention           | TBD      | +10%   |
| D7 Retention           | TBD      | +15%   |
| % dias fechados/semana | 0%       | 40%    |
| Streak médio           | TBD      | 7 dias |
| Sessions/semana        | TBD      | +20%   |
| Widget tap rate        | TBD      | +30%   |

---

## Anexos

### Arquivos-chave para modificar:

| Feature           | Arquivos                                                                         |
| ----------------- | -------------------------------------------------------------------------------- |
| Fechamento diário | `NotificationManager.swift`, `HomeTabRoot.swift`, `FinancialSummaryWidget.swift` |
| Streak visual     | `FinancialSummaryWidget.swift`, `HomeViewModel.swift`                            |
| Microcelebrações  | `AddOperationSheet.swift`, `PlannedInlineView.swift`                             |
| Widget CTA        | `*Widget.swift` (5 arquivos)                                                     |
| Instrumentação    | Novo: `AnalyticsService.swift`                                                   |

### Referências de design (externos):

- [Duolingo Streak Psychology](https://www.duolingo.com/blog)
- [Atomic Habits (James Clear)](https://jamesclear.com/atomic-habits)
- [Hooked Model (Nir Eyal)](https://www.nirandfar.com/hooked/)

---

_Auditoria completa. Próximo passo: aprovar plano com usuário e iniciar Semana 1._
