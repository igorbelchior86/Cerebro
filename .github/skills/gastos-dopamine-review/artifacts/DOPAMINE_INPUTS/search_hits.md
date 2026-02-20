# Search hits (selected)

## term: gauge
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1456:            // CRITICAL FIX: Update cachedCurrentMonthSummary for the widget gauge
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1457:            // Without this, the gauge shows 0,00 after fresh install until cache is reloaded
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/NotificationsSettingsView.swift:311:                                            icon: "gauge.with.dots.needle.67percent",
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Tips/GaugeDoubleTapTip.swift:6:  static let doubleTapEvent = Event(id: "home-gauge-double-tap")
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift:65:  private let gaugeTip = GaugeDoubleTapTip()
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift:316:          .popoverTip(gaugeTip, arrowEdge: .top)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Components/FinancialSummaryWidget.swift:101:/// Compact metric view without the colored bar indicator (gauge replaces it)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Components/FinancialSummaryWidget.swift:128:/// Semicircular gauge showing income vs expense ratio at a glance
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Components/FinancialSummaryWidget.swift:188:            let statusText = gaugeStatusText
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Components/FinancialSummaryWidget.swift:236:    private var gaugeStatusText: (text: String, color: Color) {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Components/FinancialSummaryWidget.swift:279:/// Extracted static view for the gauge arcs to improve performance.
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/swift-protobuf/Tests/SwiftProtobufTests/Test_Any.swift:877:        // Upstream most langauges end up validating the type_url during encoding as well

## term: Panorama
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1019:                    // Note: This aligns with PanoramaSheet logic where a snapshot is for a specific month.
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1035:                            // Actually, calculating hash here on 'filteredTransactions' might separate it from 'Panorama' logic which uses 'all valid'.
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:7:struct PanoramaView: View {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:28:  @State private var cachedBudgetDisplays: [String: BudgetCardPanoramaDisplay] = [:]
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:218:      return "Panorama"
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:267:        PanoramaHistoryWidget(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:283:              "✅ [PanoramaSheet] SnapshotSummaryCard RENDERED with closedCount: \(summary.closedCount)"
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:308:              "✅ [PanoramaSheet] closedCyclesSection RENDERED with \(cachedClosedSnapshots.count) snapshots"
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:686:    budget: Budget, display: BudgetCardPanoramaDisplay, score: [BudgetCycleStatus]
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:691:    let displayWithScore = BudgetCardPanoramaDisplay(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:760:      debugPrint("🔍 [PanoramaSheet] Triggering closure service with \(budgets.count) budgets")
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:922:        var displays: [String: BudgetCardPanoramaDisplay] = [:]
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:944:          let emphasis: BudgetCardPanoramaDisplay.Emphasis
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:951:          displays[data.id] = BudgetCardPanoramaDisplay(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:978:          let ghostDisplay = BudgetCardPanoramaDisplay(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:1090:    var displays: [String: BudgetCardPanoramaDisplay] = [:]
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:1096:      let emphasis: BudgetCardPanoramaDisplay.Emphasis
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:1114:      let display = BudgetCardPanoramaDisplay(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:1232:          debugPrint("⚠️ [PanoramaSheet] Failed to save month snapshot: \(error)")
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:1259:// PanoramaSummaryWidget replaced by shared FinancialSummaryWidget
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:1261:private struct PanoramaHistoryWidget: View {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:1520:// Wait, I saw it triggered "Error: no such file" when searching for PanoramaSheet.
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:1559:#Preview("PanoramaView") {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:1560:  PanoramaView(currencyProfile: CurrencyProfiles.profile(for: "BR"))
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/GastosSwiftUIApp.swift:100:              DebugLogger.debug("SETTING PENDING DEEP LINK ACTION: Panorama")
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/GastosSwiftUIApp.swift:177:    case budget(id: String)  // Navigate to Panorama and highlight budget
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Tabs/PanoramaTabRoot.swift:5:struct PanoramaTabRoot: View {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Tabs/PanoramaTabRoot.swift:13:        PanoramaView(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:653:        PanoramaTabRoot(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1848:  /// entre Accordion, Dropdown, Panorama e Pills, respeitando os ciclos do orçamento.
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Services/BudgetCycleClosureService.swift:27:        // This mirrors logic in PanoramaSheet and ContentView
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/ActiveBudgetsWidget.swift:534:        .widgetURL(URL(string: "gastos://panorama")) // Link background to Panorama
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/BudgetsStore.swift:353:  /// **ÚNICA FONTE DE VERDADE** para exibição em UI (Accordion, Dropdown, Panorama, Pills)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/BudgetsStore.swift:365:  /// Usado para renderizar Accordion, Panorama e filtros do Dropdown
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosApp/Sources/GastosApp/Services/BudgetReconciliationService.swift:132:             // Useful for debugging why hash failed (e.g. if passed transactions were different than what Panorama sees)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosCore/Sources/GastosCore/Budgets/BudgetCalculationService.swift:8:// Todas as views (Accordion, Panorama, Widget, etc.) DEVEM usar este serviço.
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosCore/Sources/GastosCore/Budgets/BudgetCalculationService.swift:89:/// 3. Panorama (PanoramaSheet.swift - budgetCardsSection)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/Sources/GastosData/Notifications/PushCoordinator.swift:80:            // Budget notification tapped - navigate to Panorama and highlight budget
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosDesign/Sources/GastosDesign/Components/AppHeader.swift:103:        case .cards: return "Panorama"
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosDesign/Sources/GastosDesign/Components/BudgetCardView.swift:5:/// Display data for a budget card in Panorama view
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosDesign/Sources/GastosDesign/Components/BudgetCardView.swift:6:public struct BudgetCardPanoramaDisplay: Sendable, Identifiable {
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosDesign/Sources/GastosDesign/Components/BudgetCardView.swift:60:    let display: BudgetCardPanoramaDisplay
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosDesign/Sources/GastosDesign/Components/BudgetCardView.swift:63:        display: BudgetCardPanoramaDisplay
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosDesign/Sources/GastosDesign/Components/BudgetCardView.swift:214:                display: BudgetCardPanoramaDisplay(
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosDesign/Sources/GastosDesign/Components/BudgetCardView.swift:226:                display: BudgetCardPanoramaDisplay(
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosDesign/Sources/GastosDesign/Components/BudgetCardView.swift:238:                display: BudgetCardPanoramaDisplay(
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosJSBridge/Sources/GastosJSBridge/JSEngine.swift:180:    public func computePanoramaMonthlySummary(
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosJSBridge/Sources/GastosJSBridge/JSEngine.swift:184:    ) throws -> JSPanoramaSummary {
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosJSBridge/Sources/GastosJSBridge/JSEngine.swift:211:            "computePanoramaMonthlySummary",
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosJSBridge/Sources/GastosJSBridge/JSEngine.swift:214:            throw EngineError.callFailed("computePanoramaMonthlySummary")

## term: Budget
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:148:    var dailyBudgetLookupVersion: Int = 0
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:305:    // Daily Budget Lookup Computations
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:306:    private var dailyBudgetLookupTask: Task<Void, Never>? = nil
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:745:        budgetsSnapshot: [Budget],
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:974:    // MARK: - Daily Budget Lookup Computation
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:977:    func scheduleDailyBudgetLookupComputation(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:980:        budgets: [Budget],
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:986:        dailyBudgetLookupTask?.cancel()
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:988:        dailyBudgetLookupTask = Task.detached(priority: .utility) { [weak self] in
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:990:            var lookup: [String: [BudgetCardDisplay]] = [:]
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:996:            let triggerLookup = balancesCalculator.makeBudgetTriggerLookup(budgets: budgets)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1008:                    let cycleBudget = Budget(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1020:                    var snapshotData: BudgetCycleSnapshot? = nil
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1024:                         let snapshotResult = BudgetReconciliationService.reconcileSync(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1050:                        if balancesCalculator.isBudgetTriggerTransaction(tx, lookup: triggerLookup) { return false }
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1055:                    let displayData = BudgetCalculationService.from(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1056:                        budget: cycleBudget,
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1063:                        snapshotStatus: snapshotData != nil ? BudgetCalculationService.mapStatus(snapshotData!.status) : nil
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1066:                    let card = BudgetCardDisplay(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1067:                        id: "\(cycleBudget.id)|\(cycle.startISO)",
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1084:            let budgetsByTag = Dictionary(grouping: budgets.filter { $0.isActive }, by: { balancesCalculator.normalizedBudgetKeyTag($0.tagId) ?? "" })
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1090:                if balancesCalculator.isBudgetTriggerTransaction(tx, lookup: triggerLookup) { continue }
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1091:                guard let tag = balancesCalculator.normalizedBudgetKeyTag(tx.budgetTag),
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1092:                      let tagBudgets = budgetsByTag[tag],
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1097:                for budget in tagBudgets {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1104:                        let cycleBudget = Budget(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1114:                             if balancesCalculator.isBudgetTriggerTransaction(tx, lookup: triggerLookup) { return false }
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1119:                        let displayData = BudgetCalculationService.from(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1120:                            budget: cycleBudget,
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1129:                        let card = BudgetCardDisplay(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1147:            await self?.finalizeDailyBudgetLookup(finalLookup)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1152:    private func finalizeDailyBudgetLookup(_ lookup: [String: [BudgetCardDisplay]]) {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1155:            self.yearViewCache.setDailyBudgetLookup(lookup)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1156:            dailyBudgetLookupVersion &+= 1
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1161:    nonisolated private static func emphasis(for status: BudgetStatus) -> BudgetCardDisplay.Emphasis {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1216:        budgetsSnapshot: [Budget],
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1287:        budgetsSnapshot: [Budget],
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1364:        budgets: [Budget],
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1474:        budgets: [Budget],
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1484:        // A. Filter Transactions (Exclude Budget Triggers + duplicate recurrence occurrences)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/ContentViewState.swift:24:    @Published var budgetAutocompleteSnapshot: [Budget] = []
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/ContentViewState.swift:27:    @Published var suppressedBudgetIds: Set<String> = []
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/ContentViewState.swift:32:    @Published var highlightBudgetID: String? = nil
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/EditBudgetSheet.swift:6:struct EditBudgetSheet: View {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/EditBudgetSheet.swift:12:  let budget: Budget
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/EditBudgetSheet.swift:32:  init(budget: Budget) {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/EditBudgetSheet.swift:156:        // Chama o update no BudgetsStore
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/AddOperationSheet.swift:10:fileprivate enum BudgetSuggestionEmphasis {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/AddOperationSheet.swift:14:fileprivate struct BudgetAutocompleteSuggestion: Identifiable {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/AddOperationSheet.swift:22:    let emphasis: BudgetSuggestionEmphasis

## term: Commitment
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/GastosSwiftUIApp.swift:314:    includeCommitments: Bool = false,
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/GastosSwiftUIApp.swift:320:      includeCommitments: includeCommitments,
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:82:  @State private var widgetSyncRequestedCommitments: Bool = false
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:455:      // Sync Commitments Widget when plannedViewModel is updated
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:460:          includeCommitments: true,
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1229:    includeCommitments: Bool = false,
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1251:      includeCommitments: includeCommitments,
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1310:    includeCommitments: Bool = false,
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1315:    widgetSyncRequestedCommitments = widgetSyncRequestedCommitments || includeCommitments
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1324:      let commitments = widgetSyncRequestedCommitments
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1327:      widgetSyncRequestedCommitments = false
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1331:        includeCommitments: commitments,
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1479:            includeCommitments: false,
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/GastosWidgetBundle.swift:19:        CommitmentsWidget()
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/CommitmentsWidget.swift:9:struct CommitmentsProvider: TimelineProvider {
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/CommitmentsWidget.swift:14:    func placeholder(in context: Context) -> CommitmentsEntry {
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/CommitmentsWidget.swift:15:        CommitmentsEntry(date: Date(), snapshot: Self.placeholderSnapshot())
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/CommitmentsWidget.swift:18:    func getSnapshot(in context: Context, completion: @escaping (CommitmentsEntry) -> Void) {
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/CommitmentsWidget.swift:19:        let entry = CommitmentsEntry(
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/CommitmentsWidget.swift:26:    func getTimeline(in context: Context, completion: @escaping (Timeline<CommitmentsEntry>) -> Void) {
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/CommitmentsWidget.swift:30:            CommitmentsEntry(date: now.addingTimeInterval(Double(i * 2 * 3600)), snapshot: snapshot)
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/CommitmentsWidget.swift:35:    private func loadSnapshot() -> WidgetCommitmentsSnapshot? {
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/CommitmentsWidget.swift:40:        return try? JSONDecoder().decode(WidgetCommitmentsSnapshot.self, from: data)
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/CommitmentsWidget.swift:54:    private static func placeholderSnapshot() -> WidgetCommitmentsSnapshot {
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/CommitmentsWidget.swift:55:        WidgetCommitmentsSnapshot(
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/CommitmentsWidget.swift:58:                CommitmentItem(id: "1", dateISO: "2025-12-26", fullDateLabel: "26 Dez", title: "Salário", amount: "1.700,00 €", isIncome: true, isRecurring: true, paymentMethod: "Dinheiro", badgeText: "Recorrente"),
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/CommitmentsWidget.swift:59:                CommitmentItem(id: "2", dateISO: "2025-12-26", fullDateLabel: "26 Dez", title: "Dízimo", amount: "-170,00 €", isIncome: false, isRecurring: false, paymentMethod: "Dinheiro", badgeText: "Planejada"),
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/CommitmentsWidget.swift:60:                CommitmentItem(id: "3", dateISO: "2025-12-31", fullDateLabel: "31 Dez", title: "Aluguel", amount: "-900,00 €", isIncome: false, isRecurring: true, paymentMethod: "Dinheiro", badgeText: "Recorrente")
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/CommitmentsWidget.swift:67:struct CommitmentsEntry: TimelineEntry {
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/CommitmentsWidget.swift:69:    let snapshot: WidgetCommitmentsSnapshot?
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/CommitmentsWidget.swift:74:struct CommitmentsWidgetView: View {
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/CommitmentsWidget.swift:77:    let entry: CommitmentsEntry
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/CommitmentsWidget.swift:144:    private func compactRow(_ item: CommitmentItem) -> some View {
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/CommitmentsWidget.swift:177:    private func periodDays(for items: [CommitmentItem]) -> Int? {
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/CommitmentsWidget.swift:253:    private func expandedRow(_ item: CommitmentItem) -> some View {
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/CommitmentsWidget.swift:341:struct CommitmentsWidget: Widget {
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/CommitmentsWidget.swift:342:    let kind: String = "CommitmentsWidget"
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/CommitmentsWidget.swift:345:        StaticConfiguration(kind: kind, provider: CommitmentsProvider()) { entry in
/Users/igorbelchior/Documents/Github/Gastos+/GastosWidget/CommitmentsWidget.swift:346:            CommitmentsWidgetView(entry: entry)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosApp/Tests/GastosAppTests/WidgetSyncCoordinatorTests.swift:44:            includeCommitments: false,
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosApp/Sources/GastosApp/Services/WidgetSyncService.swift:662:  // MARK: - Commitments Widget Sync
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosApp/Sources/GastosApp/Services/WidgetSyncService.swift:664:  /// Syncs the "Compromissos" (Upcoming Commitments) widget with pre-computed data.
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosApp/Sources/GastosApp/Services/WidgetSyncService.swift:671:  func syncCommitments(
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosApp/Sources/GastosApp/Services/WidgetSyncService.swift:687:      Self.performSyncCommitments(
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosApp/Sources/GastosApp/Services/WidgetSyncService.swift:696:  private static func performSyncCommitments(
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosApp/Sources/GastosApp/Services/WidgetSyncService.swift:709:      "📱 WidgetSync[Commitments]: Starting sync for \(todayISO) with \(sections.count) sections")
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosApp/Sources/GastosApp/Services/WidgetSyncService.swift:733:    Self.debugLog("📱 WidgetSync[Commitments]: Found \(allItems.count) items from today onwards")
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosApp/Sources/GastosApp/Services/WidgetSyncService.swift:807:    let commitmentItems: [CommitmentItem] = selectedItems.map { item in
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosApp/Sources/GastosApp/Services/WidgetSyncService.swift:808:      CommitmentItem(
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosApp/Sources/GastosApp/Services/WidgetSyncService.swift:833:    let snapshot = WidgetCommitmentsSnapshot(

## term: planned
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:19:    case planned
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:28:    case planned    // PlannedInlineView
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:84:    var plannedSelectedDate: Date = Date()
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:379:        case .planned:
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:381:            let selectedYear = Calendar.utc().component(.year, from: plannedSelectedDate)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:386:            return formatter.string(from: plannedSelectedDate).capitalized
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:430:             var components = calendar.dateComponents([.year, .month, .day], from: plannedSelectedDate)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:433:                 plannedSelectedDate = newDate
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:490:        let date = targetDate ?? plannedSelectedDate
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:491:        plannedSelectedDate = date // Update selection
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:492:        homeViewMode = .planned
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:494:        // Planned and DayGrid are siblings: planned should live at level 1.
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:693:            // "Realized" expenses only (not planned, not deleted, negative amount)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:694:            if !txn.deleted, !txn.planned, txn.amountMinor < 0, dateSet.contains(txn.opDate) {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:959:    // which correctly uses projected (not realized) inflow/outflow to include planned transactions.
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:960:    // Do NOT use fallback calculations that exclude planned transactions - always rely on applyResolvedBalances.
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1227:            // Use PROJECTED for chaining to include planned/recurring transactions
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1540:                planned: tx.planned,
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1560:        // The engine includes planned transactions that may not be visible in display items.
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1600:            // The engine includes ALL planned transactions; re-calculating from display items misses some.
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/AddOperationSheet.swift:43:    public enum PaidStatus: String, CaseIterable, Sendable { case paid = "Paga", planned = "Planejada" }
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/AddOperationSheet.swift:374:                    paidStatus = .planned
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/AddOperationSheet.swift:1419:        let paidStatus: PaidStatus = transaction.planned ? .planned : .paid
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/AddOperationSheet.swift:2136:                    .rotationEffect(.degrees(status == .planned ? 180 : 0))
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/AddOperationSheet.swift:2154:            status = (status == .paid) ? .planned : .paid
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/RecurringTransactionBuilder.swift:33:            planned: base.planned,
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:840:            guard let txDate = ISODateOnly.parseUTC(tx.opDate), !tx.deleted, !tx.planned else {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:868:            guard !tx.deleted, !tx.planned else { continue }
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:1173:        guard !tx.deleted, !tx.planned else { continue }
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/GastosSwiftUIApp.swift:174:    case planned(date: String? = nil, highlightIds: [String]? = nil)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/GastosSwiftUIApp.swift:194:  private var plannedViewModelInstance: PlannedViewModel?
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/GastosSwiftUIApp.swift:250:  func plannedViewModel() -> PlannedViewModel {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/GastosSwiftUIApp.swift:251:    if let existing = plannedViewModelInstance {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/GastosSwiftUIApp.swift:262:    plannedViewModelInstance = viewModel
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/GastosSwiftUIApp.swift:287:    plannedViewModelInstance = nil
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/GastosSwiftUIApp.swift:474:    // We look for any transaction (realized or planned) that has this budgetTag
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/GastosSwiftUIApp.swift:492:          planned: tx.planned,
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Components/DSToolbar.swift:169:                onNavigateTo(.planned)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Components/DSToolbar.swift:185:                onNavigateTo(.planned)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Components/DSToolbar.swift:194:        case .planned:
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Components/DSToolbar.swift:553:                                            homeViewMode = homeViewMode == .grid ? .planned : .grid
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Components/DSToolbar.swift:606:                    if navigationLevel == .planned {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Components/DSToolbar.swift:645:                                    homeViewMode = .planned
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Components/DSToolbar.swift:649:                                case .planned:
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Components/DSToolbar.swift:659:                            Image(systemName: navigationLevel == .planned ? "square.grid.3x3" : "calendar.badge.clock")
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Components/PlannedInlineView.swift:24:    @AppStorage("plannedCalendarCollapsedDefault") private var isCalendarCollapsed: Bool = false
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Components/PlannedInlineView.swift:103:                    plannedList
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Components/PlannedInlineView.swift:162:    private var plannedList: some View {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Components/PlannedInlineView.swift:292:            planned: true,
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Components/SearchResultsView.swift:12:    let plannedTransactions: [GastosCore.Transaction]

## term: schedule
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:58:                 // Trigger computation via existing scheduler (with debounce)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:60:                 // If data is missing, the scheduler will handle it or skip
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:64:                    Actually, we assume the Recursive Chaining logic in 'scheduleResolvedBalancesComputation' 
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:458:               // The scheduler needs arguments that we normally pass from View...
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:460:               // COMPROMISE: We rely on `scheduleResolvedBalancesComputation` being smart.
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:461:               // But `schedule` is usually called by View with Fresh Data.
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:469:               // Actually, `applyResolvedBalances` calls `scheduleResolvedBalancesComputation` recursively for Y+1.
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:741:    func scheduleResolvedBalancesComputation(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:898:                             self.scheduleResolvedBalancesComputation(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:957:    // DEPRECATED: scheduleMonthSummariesComputation removed.
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:977:    func scheduleDailyBudgetLookupComputation(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1339:                 scheduleResolvedBalancesComputation(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:300:        scheduledBudgetsSection
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:413:  private var scheduledBudgetsSection: some View {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:443:          ForEach(cachedScheduledBudgets) { scheduled in
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:444:            ScheduledBudgetRow(display: scheduled)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:791:    let (metrics, series, budgetDisplays, closedSnapshots, budgetScores, scheduledBudgets) =
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:995:        var scheduledBudgets: [ScheduledBudgetDisplay] = []
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:1013:              budgetScores, scheduledBudgets
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:1028:              // Create display for each scheduled cycle
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:1037:              scheduledBudgets.append(display)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:1042:          scheduledBudgets.sort { $0.startsInDays < $1.startsInDays }
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:1048:          budgetScores, scheduledBudgets
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:1062:      self.cachedScheduledBudgets = scheduledBudgets
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:1524:/// Represents a budget that is scheduled to start later in the current month
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/GastosSwiftUIApp.swift:852:      scheduleRealtimeFallbackLoadIfNeeded(dataUid: dataUid, profileId: profileId)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/GastosSwiftUIApp.swift:885:  private func scheduleRealtimeFallbackLoadIfNeeded(dataUid: String, profileId: String) {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/GastosSwiftUIApp.swift:923:        self.scheduleRealtimeFallbackLoadIfNeeded(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Components/ToastOverlayWindow.swift:114:        scheduleDismiss(duration: toast.duration)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Components/ToastOverlayWindow.swift:117:    private func scheduleDismiss(duration: TimeInterval) {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/AppShellView.swift:242:            NotificationManager.shared.scheduleInviteNotification(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/NotificationsSettingsView.swift:295:                                                // We need to fetch active budgets to reschedule properly
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift:115:    // we can schedule it:
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift:117:      viewModel.scheduleResolvedBalancesComputation(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift:597:      viewModel.scheduleDailyBudgetLookupComputation(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:394:        scheduleMemoizedComputations(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:403:        NotificationManager.shared.scheduleBudgetSurplusNotifications(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:413:        scheduleMemoizedComputations(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:431:        scheduleMemoizedComputations(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1239:      scheduleResolvedBalancesComputation(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1287:  private func scheduleMemoizedComputations(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1299:    scheduleResolvedBalancesComputation(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1338:  private func scheduleWarmupTasks() {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1343:      scheduleMemoizedComputations(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1361:  private func scheduleResolvedBalancesComputation(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1499:        scheduleResolvedBalancesComputation(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1578:    scheduleWarmupTasks()
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1583:    // Phase 2.2b: Day label precompute is scheduled in warmup tasks.
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1697:          scheduleResolvedBalancesComputation(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1716:          scheduleResolvedBalancesComputation(

## term: receipt
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/PhoneAuthProviderTests.swift:38:    private let kTestReceipt = "receipt"
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/PhoneAuthProviderTests.swift:564:        receipt: kTestReceipt,
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/PhoneAuthProviderTests.swift:579:            "receipt": self.kTestReceipt,
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/PhoneAuthProviderTests.swift:595:          XCTAssertEqual(credential.receipt, self.kTestReceipt)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/PhoneAuthProviderTests.swift:658:        receipt: kTestReceipt,
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/PhoneAuthProviderTests.swift:672:            "receipt": self.kTestReceipt,
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/PhoneAuthProviderTests.swift:711:            XCTAssertEqual(credential.receipt, self.kTestReceipt)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/PhoneAuthProviderTests.swift:775:        auth.appCredentialManager?.credential = AuthAppCredential(receipt: kTestReceipt,
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/PhoneAuthProviderTests.swift:818:            XCTAssertEqual(credential.receipt, self.kTestReceipt)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthNotificationManagerTests.swift:24:        @brief A fake receipt used for testing.
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthNotificationManagerTests.swift:111:      let payload = ["receipt": kReceipt, "secret": kSecret]
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthNotificationManagerTests.swift:135:        .canHandle(notification: ["com.google.firebase.auth": ["receipt": kReceipt]]))
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthNotificationManagerTests.swift:136:      // Missing receipt.
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthAppCredentialManagerTests.swift:44:        XCTAssertEqual(credential.receipt, self.kReceipt)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthAppCredentialManagerTests.swift:50:      // Mismatched receipt shouldn't finish verification.
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthAppCredentialManagerTests.swift:58:      XCTAssertEqual(manager.credential?.receipt, kReceipt)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthAppCredentialManagerTests.swift:61:      // Repeated receipt should have no effect.
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthAppCredentialManagerTests.swift:81:        XCTAssertEqual(credential.receipt, self.kReceipt)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthAppCredentialManagerTests.swift:92:      XCTAssertEqual(manager.credential?.receipt, kReceipt)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthAppCredentialManagerTests.swift:97:        @brief Tests the maximum allowed number of pending receipt.
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthAppCredentialManagerTests.swift:111:        XCTAssertEqual(credential.receipt, self.kReceipt)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthAppCredentialManagerTests.swift:117:      // Start verification of a number of random receipts without overflowing.
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthAppCredentialManagerTests.swift:125:          XCTAssertEqual(credential.receipt, self.kReceipt)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthAppCredentialManagerTests.swift:130:      // Finish verification of target receipt.
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthAppCredentialManagerTests.swift:133:      XCTAssertEqual(manager.credential?.receipt, kReceipt)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthAppCredentialManagerTests.swift:140:      // Start verification of another target receipt.
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthAppCredentialManagerTests.swift:144:        XCTAssertEqual(credential.receipt, self.kAnotherReceipt)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthAppCredentialManagerTests.swift:150:      // Start verification of a number of random receipts to overflow.
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthAppCredentialManagerTests.swift:158:          XCTAssertEqual(credential.receipt, randomReceipt)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthAppCredentialManagerTests.swift:163:      // Finish verification of the other target receipt.
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthAppCredentialManagerTests.swift:185:        XCTAssertEqual(credential.receipt, self.kReceipt)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthAppCredentialManagerTests.swift:200:      XCTAssertEqual(manager2.credential?.receipt, kReceipt)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthAppCredentialManagerTests.swift:206:      XCTAssertEqual(manager3.credential?.receipt, kReceipt)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/VerifyClientTests.swift:63:    let kReceiptKey = "receipt"
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/VerifyClientTests.swift:64:    let kFakeReceipt = "receipt"
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/VerifyClientTests.swift:75:    XCTAssertEqual(rpcResponse.receipt, kFakeReceipt)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthAppCredentialTests.swift:29:    let credential = AuthAppCredential(receipt: kReceipt, secret: kSecret)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthAppCredentialTests.swift:30:    XCTAssertEqual(credential.receipt, kReceipt)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthAppCredentialTests.swift:38:    let credential = AuthAppCredential(receipt: kReceipt, secret: kSecret)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/AuthAppCredentialTests.swift:46:    XCTAssertEqual(otherCredential.receipt, kReceipt)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/SendVerificationCodeTests.swift:23:  private let kTestReceipt = "receipt"
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/SendVerificationCodeTests.swift:57:    let credential = AuthAppCredential(receipt: kTestReceipt, secret: kTestSecret)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/Unit/SendVerificationCodeTests.swift:63:      XCTAssertEqual(credential.receipt, kTestReceipt)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/SampleSwift/AuthenticationExample/ViewControllers/AuthViewController.swift:500:          guard let receipt = verifyResponse.receipt,
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/SampleSwift/AuthenticationExample/ViewControllers/AuthViewController.swift:510:                withReceipt: receipt,
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/SampleSwift/AuthenticationExample/ViewControllers/SettingsViewController.swift:152:      let message = "receipt:\(credential.receipt) secret:\(credential.secret ?? "nil")"
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Tests/SampleSwift/AuthenticationExample/ViewControllers/SettingsViewController.swift:263:      let truncatedReceipt = truncatedString(string: credential.receipt, length: 13)
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Sources/Swift/SystemService/AuthAppCredentialManager.swift:23:    let kPendingReceiptsKey = "pending_receipts"
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Sources/Swift/SystemService/AuthAppCredentialManager.swift:29:    /// The maximum (but not necessarily the minimum) number of pending receipts to be kept.
/Users/igorbelchior/Documents/Github/Gastos+/Packages/GastosData/.build/checkouts/firebase-ios-sdk/FirebaseAuth/Sources/Swift/SystemService/AuthAppCredentialManager.swift:51:    func didStartVerificationInternal(withReceipt receipt: String,

## term: OCR

## term: Widget
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:92:    /// Whether the Financial Summary Widget is in minimized state (collapsed to show only Entradas/Saídas)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1439:            // We should cache the RAW components for other parts of the app (like Graphs/Widgets)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:267:        PanoramaHistoryWidget(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:1259:// PanoramaSummaryWidget replaced by shared FinancialSummaryWidget
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:1261:private struct PanoramaHistoryWidget: View {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:1292:// have been removed as they are now used from the shared FinancialSummaryWidget file or were redundant (MetricView).
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/GastosSwiftUIApp.swift:190:  private let widgetSyncCoordinator = WidgetSyncCoordinator()
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/GastosSwiftUIApp.swift:311:  func requestWidgetSync(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/GastosSwiftUIApp.swift:312:    inputs: WidgetSyncCoordinator.Inputs,
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/GastosSwiftUIApp.swift:968:    // Setup Widget Sync
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/GastosSwiftUIApp.swift:977:        await self.syncWidget()
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/GastosSwiftUIApp.swift:984:  private func syncWidget() {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/GastosSwiftUIApp.swift:985:    // Widget sync is now handled exclusively by ContentView via onChange(of: filteredTransactionsSnapshot)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/GastosSwiftUIApp.swift:992:      print("📱 AppController.syncWidget() - Delegating to ContentView (no-op)")
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift:56:  @State private var isFinancialWidgetMinimized: Bool = false
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift:57:  @State private var isWidgetLockedMinimized: Bool = false
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift:60:  @State private var lastWidgetNeedleAnimationToken: Int? = nil
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift:280:          // Summary Widget (Anchored)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift:281:          // Calculate Current Month Summary for Widget
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift:290:          let shouldAnimateNeedle = widgetAnimationToken != lastWidgetNeedleAnimationToken
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift:292:          FinancialSummaryWidget(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift:293:            isMinimized: isWidgetLockedMinimized || isFinancialWidgetMinimized,
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift:310:              isWidgetLockedMinimized.toggle()
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift:341:          lastWidgetNeedleAnimationToken = widgetAnimationToken
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift:350:  // MARK: - Scroll Handling for Collapsible Widget
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift:352:  /// Handles scroll offset changes to minimize/expand the Financial Summary Widget
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift:379:    if scrolledDown && !isFinancialWidgetMinimized {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift:381:        isFinancialWidgetMinimized = true
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift:383:    } else if atTop && isFinancialWidgetMinimized {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift:385:        isFinancialWidgetMinimized = false
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift:393:  /// The snap anchor point is the base of the FinancialSummaryWidget.
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/Views/Components/FinancialSummaryWidget.swift:4:struct FinancialSummaryWidget: View {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:245:  /// Widget dashboard overrides if data is ready (uses cached values from ViewModel)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:341:      // MARK: - Direct Deep Link Handler (Widget buttons)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:362:            // app lifecycle transitions complete (HomeViewModel cache, WidgetSync, scenePhase changes)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:399:        enqueueWidgetSync(includeBalanceToday: false)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:430:        enqueueWidgetSync(includeBalanceToday: true)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:449:        enqueueWidgetSync(includeBalanceToday: false, debounceNanoseconds: 0)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:455:      // Sync Commitments Widget when plannedViewModel is updated
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:458:        enqueueWidgetSync(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1227:  private func requestWidgetSync(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1247:    let inputs = makeWidgetSyncInputs(resolvedBalances: balances)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1248:    controller.requestWidgetSync(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1256:  private func makeWidgetSyncInputs(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1258:  ) -> WidgetSyncCoordinator.Inputs {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1260:      WidgetSyncCoordinator.PlannedSection(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1263:          WidgetSyncCoordinator.PlannedItem(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1274:    return WidgetSyncCoordinator.Inputs(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1308:  private func enqueueWidgetSync(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ContentView.swift:1329:      requestWidgetSync(

## term: snapshot
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:263:        let snapshotVersion: Int
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:459:               // However, we can't easily access snapshot data here without dependency injection.
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:798:        let snapshotVersion = 0 
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:825:            snapshotVersion: snapshotVersion,
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:982:        candidateSnapshots: [String: MonthSnapshot] = [:] // Injected snapshots for materialization
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1019:                    // Note: This aligns with PanoramaSheet logic where a snapshot is for a specific month.
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1020:                    var snapshotData: BudgetCycleSnapshot? = nil
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1023:                         // Check if we have a valid snapshot for this month
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1024:                         let snapshotResult = BudgetReconciliationService.reconcileSync(
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1030:                            // However, strictly speaking, if the snapshot exists and we trust the Candidate passed in...
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1037:                            // DECISION: To ensure strict correctness, we will use the snapshot ONLY if its cycle matches
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1043:                         if case .useSnapshot(let snap) = snapshotResult {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1044:                             // Find specific budget cycle in the snapshot
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1045:                             snapshotData = snap.budgetSnapshots.first(where: { $0.budgetId == budget.id && $0.cycleEndISO == cycle.endISO })
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1061:                        snapshotSpent: snapshotData?.spentMinor,
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1062:                        snapshotLimit: snapshotData?.limitMinor,
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/HomeViewModel.swift:1063:                        snapshotStatus: snapshotData != nil ? BudgetCalculationService.mapStatus(snapshotData!.status) : nil
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/ViewModels/ContentViewState.swift:9:    let snapshotVersion: Int
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:63:    // 2. Add all months that have budget snapshots (filtered by current month)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:65:      for snap in store.snapshots {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:165:          guard !newBudgets.isEmpty, let snapshotsStore = controller.stores.budgetCycleSnapshots
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:168:            let closureService = BudgetCycleClosureService(snapshotsStore: snapshotsStore)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:308:              "✅ [PanoramaSheet] closedCyclesSection RENDERED with \(cachedClosedSnapshots.count) snapshots"
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:546:          ForEach(cachedClosedSnapshots) { snapshot in
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:547:            ClosedCycleRow(snapshot: snapshot)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:562:    let snapshot: BudgetCycleSnapshot
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:580:            if snapshot.status == .overspent {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:613:      switch snapshot.status {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:621:      guard let rawTag = snapshot.budgetNameSnapshot else { return "Orçamento" }
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:631:      return formatPeriodRange(startISO: snapshot.cycleStartISO, endISO: snapshot.cycleEndISO)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:648:      let val = Double(snapshot.varianceMinor) / 100.0
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:654:      f.currencyCode = snapshot.currencyCode ?? "BRL"
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:657:      if snapshot.varianceMinor > 0 {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:659:      } else if snapshot.varianceMinor < 0 {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:731:    let snapshotMonthKey = ISODateOnly.monthKey(from: selectedMonth)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:733:    let isHistorical = snapshotMonthKey != currentMonthKey
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:749:      if case .useSnapshot(let snapshot) = result {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:750:        applySnapshot(snapshot)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:759:    if let snapshotsStore = controller.stores.budgetCycleSnapshots {
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:761:      let closureService = BudgetCycleClosureService(snapshotsStore: snapshotsStore)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:774:      let monthSnapshots = store.snapshots(for: snapshotMonthKey)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:775:      currentSnapshots = monthSnapshots.filter { snapshot in
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:776:        guard let budget = budgets.first(where: { $0.id == snapshot.budgetId }) else { return true }
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:779:          return snapshot.cycleStartISO >= startPart
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:899:            // If it already has a closed snapshot for this month, don't show live active card
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:928:          // Find snapshot for this budget in this cycle (Fiscal Month logic)
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:939:            snapshotSpent: snap?.spentMinor,
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:940:            snapshotLimit: snap?.limitMinor,
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:941:            snapshotStatus: snap != nil ? BudgetStatus(rawValue: snap!.status.rawValue) : nil
/Users/igorbelchior/Documents/Github/Gastos+/GastosSwiftUI/PanoramaView.swift:1052:    let summary = SnapshotMonthSummary(snapshots: closedSnapshots)

