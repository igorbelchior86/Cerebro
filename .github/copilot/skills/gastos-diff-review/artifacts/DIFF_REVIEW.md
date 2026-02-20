# DIFF REVIEW

## Resumo do que mudou
- **Tipo**: Bugfix / Refactor / UI Polish
- **Áreas afetadas**: Home Screen, Financial Summary Widget, HomeViewModel.
- **Intenção provável**: Resolver o "layout flash" na inicialização do widget, estabilizar o comportamento de colapso via scroll e centralizar o estado de UI puramente visual na View em vez do ViewModel.

## Mudanças de risco (rápido)
- **Risco de regressão**: Baixo. As mudanças são focadas na lógica de scroll da home.
- **Risco de dados**: Nenhum. Não há alteração em persistência ou modelos de dados.
- **Risco de performance**: Baixo/Positivo. A remoção de estado de UI do ViewModel reduz atualizações desnecessárias em observadores do ViewModel.
- **Risco de concorrência**: Nenhum.
- **Risco de arquitetura**: Positivo. O estado de minimização do widget é agora local à `HomeTabRoot`, o que é mais adequado para estados de scroll/transição.

## Comentários por arquivo

### GastosSwiftUI.xcodeproj/project.pbxproj
- **O que mudou**: `MARKETING_VERSION` atualizada para `2.33.14` e `CURRENT_PROJECT_VERSION` para `11`.
- **Risco**: Nenhum.
- **Recomendações**: Segue a política de versionamento do projeto.

### GastosSwiftUI/ViewModels/HomeViewModel.swift
- **O que mudou**: Remoção da propriedade `isFinancialWidgetMinimized`.
- **Risco**: Nenhum.
- **Recomendações**: Mudança correta para desacoplar estado de animação de scroll da lógica de negócio.

### GastosSwiftUI/Views/Components/FinancialSummaryWidget.swift
- **O que mudou**: Refatoração do layout colapsável, ajuste de padding e correção no cálculo do texto do gauge (`gaugeStatusText` agora usa `targetProgress`).
- **Risco**: Baixo.
- **Recomendações**: A mudança para `targetProgress` resolve o "flickering" do texto durante a animação de inicialização. O agrupamento em `VStack` com uma única transição simplifica o código.
- **Testes/validação**: Verificar se a animação de opacidade/escala ainda parece fluida.

### GastosSwiftUI/Views/Tabs/HomeTabRoot.swift
- **O que mudou**: Implementação da lógica de estabilização de scroll (`hasScrollStabilized`) e novos thresholds para colapso (foco em Fev/Mar).
- **Risco**: Médio. Mudanças em thresholds de scroll podem ser sensíveis a diferentes tamanhos de tela.
- **Recomendações**: A lógica de estabilização resolve o problema do widget colapsar erroneamente no launch. Os novos valores de threshold (`-100` e `-110`) criam uma histerese que evita o "jitter".
- **Testes/validação**: Fazer manual smoke test em diferentes simuladores (Pro vs SE) para garantir que o threshold de Fev/Mar funciona bem em todos.

## Problemas por severidade

### P0 (bloqueia merge)
*Nenhum identificado.*

### P1 (deve corrigir antes de merge)
*Nenhum identificado.*

### P2 (melhoria / follow-up)
- **Item**: Logs de Debug em produção.
  - **Evidência**: `print("🟢 Scroll stabilized...")` e `print("🔵 Scroll offset: \(offset)")` em `HomeTabRoot.swift`.
  - **Impacto**: Poluição de console em produção.
  - **Correção sugerida**: Envolver prints em `#if DEBUG` ou remover após validação.
  - **Teste/validação exigida**: Apenas revisão de código.

## Sugestões objetivas de correção
1. Remover ou silenciar os prints de debug em `HomeTabRoot.swift:L238` e `L251`.
2. Validar o comportamento do threshold em modo paisagem (se o app suportar).

## Checklist de testes antes de merge
- [x] Build (Debug)
- [ ] Smoke: app launch (validar que o widget NÃO colapsa no primeiro frame)
- [ ] Scroll na Home: validar colapso entre o final de Fevereiro e início de Março.
- [ ] Scroll reverso: validar expansão suave sem "pulo" visual.
- [ ] Widgets: Build do target `GastosWidget` para garantir que o incremento de versão foi propagado corretamente.

## Patch sugerido (opcional)
```diff
--- a/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift
+++ b/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift
@@ -235,7 +235,9 @@ private func handleHomeScrollOffsetChange(_ offset: CGFloat) {
             if let lastOffset = lastStableOffset {
                 if abs(offset - lastOffset) < 5 {
                     hasScrollStabilized = true
+                    #if DEBUG
                     print("🟢 Scroll stabilized at offset: \(offset)")
+                    #endif
                 }
             }
             lastStableOffset = offset
@@ -248,7 +250,9 @@ private func handleHomeScrollOffsetChange(_ offset: CGFloat) {
         }
         
         // DEBUG: Print offset value
+        #if DEBUG
         print("🔵 Scroll offset: \(offset)")
+        #endif
```
