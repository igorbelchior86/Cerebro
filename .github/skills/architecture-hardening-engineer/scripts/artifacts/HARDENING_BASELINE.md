# HARDENING BASELINE

Generated: 2026-01-11T19:14:01Z

## Vendor imports (Firebase heuristic)
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Notifications/PushCoordinator.swift:6:import FirebaseMessaging
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Accounts/AccountDeletionService.swift:2:import FirebaseAuth
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Accounts/AccountDeletionService.swift:3:import FirebaseCore
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Accounts/AccountDeletionService.swift:4:import FirebaseDatabase
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Accounts/AccountMergeService.swift:2:@preconcurrency import FirebaseDatabase
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Accounts/AccountMergeService.swift:3:import FirebaseCore
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Firebase/FirebaseSession.swift:2:@preconcurrency import FirebaseCore
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Firebase/FirebaseSession.swift:3:@preconcurrency import FirebaseAuth
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Firebase/FirebaseSession.swift:4:@preconcurrency import FirebaseDatabase
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Realtime/PublicProfileRepository.swift:2:@preconcurrency import FirebaseDatabase
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Realtime/PublicProfileRepository.swift:3:import FirebaseCore
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Realtime/AppBootstrapRepository.swift:2:@preconcurrency import FirebaseDatabase
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Realtime/AppBootstrapRepository.swift:3:@preconcurrency import FirebaseCore
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Realtime/TransactionsWriter.swift:2:@preconcurrency import FirebaseCore
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Realtime/TransactionsWriter.swift:3:@preconcurrency import FirebaseDatabase
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Realtime/RealtimeSyncer.swift:2:@preconcurrency import FirebaseDatabase
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Realtime/UserMetaRepository.swift:2:@preconcurrency import FirebaseDatabase
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Realtime/UserMetaRepository.swift:3:import FirebaseCore
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Realtime/InvitesRepository.swift:2:@preconcurrency import FirebaseDatabase
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Realtime/InvitesRepository.swift:3:import FirebaseCore
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Realtime/BudgetsWriter.swift:2:@preconcurrency import FirebaseCore
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Realtime/BudgetsWriter.swift:3:@preconcurrency import FirebaseDatabase
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Realtime/FirebaseRealtimeService.swift:3:@preconcurrency import FirebaseCore
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Realtime/FirebaseRealtimeService.swift:4:@preconcurrency import FirebaseDatabase
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Auth/GoogleSignInService.swift:3:@preconcurrency import FirebaseCore
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Auth/GoogleSignInService.swift:4:@preconcurrency import FirebaseAuth
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Auth/FirebaseAuthSession.swift:2:@preconcurrency import FirebaseAuth

## print(
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosWidget/ActiveBudgetsWidget.swift:156:        print("📱 Widget: Generated \(entries.count) timeline entries, next refresh at \(refreshDate)")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosWidget/ActiveBudgetsWidget.swift:241:                print("Widget Snapshot Decode Error: \(error)")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosWidget/ActiveBudgetsWidget.swift:259:                print("Widget Legacy Decode Error: \(error)")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosWidget/BalanceTodayWidget.swift:61:        print("📱 BalanceTodayWidget: Generated \(entries.count) timeline entries, next refresh at \(refreshDate)")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosWidget/BalanceTodayWidget.swift:67:            print("📱 BalanceTodayWidget: No snapshot found in App Group")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosWidget/BalanceTodayWidget.swift:73:            print("📱 BalanceTodayWidget: No snapshot found in App Group")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosWidget/BalanceTodayWidget.swift:79:            print("📱 BalanceTodayWidget: Loaded snapshot from \(snapshot.generatedAt)")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosWidget/BalanceTodayWidget.swift:82:            print("📱 BalanceTodayWidget: Decode error: \(error)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosJSBridge/Sources/GastosJSBridge/JSEngine.swift:20:            if let exc = exception { print("[GastosJSBridge] JS Exception: \(exc)") }
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosJSBridge/Sources/GastosJSBridge/JSEngine.swift:26:            print("[GastosJSBridge] Failed to load JS: \(error)")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/ContentView.swift:440:                    print("🔗 CONSUMING DEEP LINK MANAGER ACTION: Add Transaction")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/ContentView.swift:1028:        print("DEBUG: promptRecurrenceAction kind=\(kind)")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/ContentView.swift:1524:        print("🔗 [DEBUG] presentAddTransaction called - activeSheet=\(String(describing: activeSheet)), timeSinceLast=\(now - lastAddTransactionTriggerTime)")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/ContentView.swift:1526:            print("🔗 [DEBUG] presentAddTransaction SKIPPED - sheet already open")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/ContentView.swift:1530:            print("🔗 [DEBUG] presentAddTransaction SKIPPED - within dedup interval")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/ContentView.swift:1537:        print("🔗 [DEBUG] presentAddTransaction DEFERRING to next run loop")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/ContentView.swift:1539:            print("🔗 [DEBUG] presentAddTransaction EXECUTING - setting activeSheet = .addTransaction")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/ContentView.swift:1857:        // print("DEBUG: handleTransactionEdit id=\(display.id)") // Removed debug print
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/ContentView.swift:1871:        // print("DEBUG: handleTransactionDelete id=\(display.id)") // Removed debug print
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/AddOperationSheet.swift:745:        print("DEBUG: AddOperationSheet - Calling onSubmit")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/AddOperationSheet.swift:755:            print("DEBUG: AddOperationSheet - Calling dismiss")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/AddOperationSheet.swift:1857:        print(op)
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift:312:                    print("🟢 Scroll stabilized at offset: \(offset)")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/Views/Tabs/HomeTabRoot.swift:322:        print("🔵 Scroll offset: \(offset)")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/GastosSwiftUIApp 2.swift:88:                        print("🔗 DEEP LINK RECEIVED: \(url.absoluteString)")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/GastosSwiftUIApp 2.swift:101:                                print("🔗 SETTING PENDING DEEP LINK ACTION: Panorama")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/GastosSwiftUIApp 2.swift:110:                    print("📲 FALLBACK NOTIFICATION RECEIVED")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/GastosSwiftUIApp 2.swift:149:             print("❌ [DEBUG] Failed to register for remote notifications: \(error)")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/GastosSwiftUIApp 2.swift:157:            print("APNs Token received: \(maskedToken)")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/GastosSwiftUIApp 2.swift:575:        print("DEBUG: Bootstrap - AuthUID: \(credentials.userId)")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/GastosSwiftUIApp 2.swift:576:        print("DEBUG: Bootstrap - DataUID: \(dataUid)")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/GastosSwiftUIApp 2.swift:577:        print("DEBUG: Bootstrap - Match? \(credentials.userId == dataUid)")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/GastosSwiftUIApp 2.swift:834:        print("📱 AppController.syncWidget() - Delegating to ContentView (no-op)")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/GastosSwiftUIApp 2.swift:992:                print("🔗 DeepLinkManager: Found persisted pending intent")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/ShareAccountView.swift:370:        print(message)
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/Components/ToastOverlayWindow.swift:24:            print("🍞 [ToastOverlay] Creating window with scene: \(scene)")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/Components/ToastOverlayWindow.swift:27:            print("🍞 [ToastOverlay] WARNING: No scene found, falling back to main bounds")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/Components/ToastOverlayWindow.swift:42:             print("🍞 [ToastOverlay] Window frame set to: \(w.frame)")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/Components/ToastOverlayWindow.swift:50:            print("🍞 [ToastOverlay] Error: Window is nil")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/Components/ToastOverlayWindow.swift:76:                print("🍞 [ToastOverlay] Host view constraints activated")
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/Components/ToastOverlayWindow.swift:80:            print("🍞 [ToastOverlay] Host content refreshed")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosCore/Tests/GastosCoreTests/YearMonthlyProjectionGoldenTests.swift:62:        print("🧪 Running Golden Test: \(fixture.scenario)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosCore/Tests/GastosCoreTests/YearMonthlyProjectionGoldenTests.swift:110:        print("✅ Golden test passed: \(fixture.expectedMonthlyProjections.count) months verified")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosCore/Tests/GastosCoreTests/TransactionSanitizeTests.swift:24:        print("🧪 Running Sanitize Test: \(fixture.scenario)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Accounts/AccountMergeService.swift:288:        print(message)
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosCore/Sources/GastosCore/Models/MonthSnapshot.swift:66:            print("⚠️ MonthSnapshot for \(monthKey): budgetSnapshots missing, using empty array")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosCore/Tests/GastosCoreTests/BudgetMaterializationTests.swift:83:        print("🧪 Running Golden Test: \(fixture.scenario)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosCore/Tests/GastosCoreTests/DailyBalanceGoldenTests.swift:58:        print("🧪 Running Golden Test: \(fixture.scenario)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosDesign/Sources/GastosDesign/Components/AccordionView.swift:698:            print("🎭 [AccordionDaySection] ⚠️ Environment namespace is nil, using LOCAL fallback for day \(dayNumber)/\(monthIndex + 1)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosCore/Tests/GastosCoreTests/UnifiedEngineGoldenTests.swift:8:        print("🧪 Unified Golden Test: Budget Refund Timing")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosCore/Tests/GastosCoreTests/UnifiedEngineGoldenTests.swift:138:        print("🧪 Unified Verification Test: Transaction Counts")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Services/WidgetSyncService.swift:72:        Swift.print(message())
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Services/BudgetReconciliationService.swift:95:            print("⚠️ [BudgetReconciliation] Hash Mismatch for \(monthKey). Snapshot: \(snapshot.transactionsHash) vs Current: \(currentHash)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Services/BudgetReconciliationService.swift:133:             // print("⚠️ [BudgetReconciliation] Sync Hash Mismatch: \(currentHash) vs \(snapshot.transactionsHash)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosDesign/Sources/GastosDesign/Components/AccordionScrollCoordinator.swift:493:        print("[ScrollToday] \(message)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/MonthSnapshotsStore.swift:39:            print("❌ [DEBUG] Failed to fetch month snapshot: \(error)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Realtime/PublicProfileRepository.swift:35:            print("⚠️ [PublicProfileRepository] Failed to decode profile for \(uid): \(error)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Realtime/UserMetaRepository.swift:120:            print("⚠️ [UserMetaRepository] Email update failed: \(error.localizedDescription)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Realtime/UserMetaRepository.swift:144:            print("⚠️ [UserMetaRepository] Failed to sync public profile: \(error)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Realtime/UserMetaRepository.swift:168:            print("⚠️ [UserMetaRepository] Failed to sync photoURL to public profile: \(error)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Realtime/UserMetaRepository.swift:188:                print("Error decoding UserMeta: \(error)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/AppStore.swift:206:                print("⚡️ [AppStore] Hydrating from cache for \(key)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosDesign/Sources/GastosDesign/Components/DayDetailView.swift:60:        let _ = print("📅 [DayDetailView] BODY rendered for iso: \(iso)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosDesign/Sources/GastosDesign/Components/DeleteConfirmationSheet.swift:173:                    print("✅ Confirmado: Excluir cartão")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/UserMetaStore.swift:121:            print("⚡️ [UserMetaStore] Hydrating from cache for \(key)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/UserMetaStore.swift:146:            print("[UserMetaStore] Data UID changed from \(old) to \(newDataUid)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/UserMetaStore.swift:163:            print("[UserMetaStore] Auto-syncing email: \(email)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/UserMetaStore.swift:173:            print("[UserMetaStore] Auto-syncing displayName: \(displayName)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/UserMetaStore.swift:183:            print("[UserMetaStore] Auto-syncing photoURL: \(photoURL)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/UserMetaStore.swift:208:            print("[UserMetaStore] Ensured membership for \(authUid) in \(dataUid)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/UserMetaStore.swift:212:            print("[UserMetaStore] Failed to ensure membership: \(error)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/UserMetaStore.swift:234:            print("[UserMetaStore] Loaded \(members.count) account members for \(dataUid)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/UserMetaStore.swift:238:            print("[UserMetaStore] Failed to load account members: \(error)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/UserMetaStore.swift:263:        print("🧹 [UserMetaStore] Cleared cache for \(key)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/InvitesStore.swift:476:        print(message)
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosDesign/Sources/GastosDesign/Components/AccordionDayRow.swift:113:        let _ = print("🗓️ [AccordionDayRow] BODY rendered - day: \(dayNumber), hasContent: \(hasContent)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/ViewModels/PlannedViewModel.swift:339:            print("DEBUG: Updating master \(updatedMaster.id) with exceptions: \(updatedMaster.recurrenceExceptions ?? [])")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Tests/GastosAppTests/GoldenSnapshotTests.swift:132:                print("🧪 Using selected user: \(selectedId)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Tests/GastosAppTests/GoldenSnapshotTests.swift:135:                print("⚠️ Designated user \(selectedId) not found. Falling back to first user: \(firstId)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Tests/GastosAppTests/GoldenSnapshotTests.swift:163:                print("🧪 Using profile: \(profileId)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Tests/GastosAppTests/GoldenSnapshotTests.swift:171:                     print("⚠️ Profile \(profileId) not found. Falling back to PT.")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Tests/GastosAppTests/GoldenSnapshotTests.swift:202:            print("🧪 Processando snapshot: \(layer.name)")
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Tests/GastosAppTests/GoldenSnapshotTests.swift:435:        print("📁 Saving updated snapshot to disk for \(name)")

## DispatchQueue usage
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/ContentView.swift:1538:        DispatchQueue.main.async { [self] in
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosDesign/Sources/GastosDesign/Components/AccordionView.swift:855:                DispatchQueue.main.async {
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/AddOperationSheet.swift:1425:        DispatchQueue.global(qos: .userInitiated).async {
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/AddOperationSheet.swift:1465:            DispatchQueue.main.async {
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosDesign/Sources/GastosDesign/Utils/ScrollOffsetObserver.swift:78:        DispatchQueue.main.async {
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosDesign/Sources/GastosDesign/Utils/ScrollOffsetObserver.swift:85:        DispatchQueue.main.async {
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosDesign/Sources/GastosDesign/Components/StickyMonthOverlay.swift:85:            DispatchQueue.main.async { [weak self] in
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosDesign/Sources/GastosDesign/Components/StickyMonthOverlay.swift:93:            DispatchQueue.main.async { [weak self] in
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosDesign/Sources/GastosDesign/Components/StickyMonthOverlay.swift:120:            DispatchQueue.main.async { [weak self] in
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosDesign/Sources/GastosDesign/Components/StickyMonthOverlay.swift:134:            DispatchQueue.main.async { [weak self] in
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosDesign/Sources/GastosDesign/Components/StickyMonthOverlay.swift:138:        DispatchQueue.main.async { [weak self] in
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosDesign/Sources/GastosDesign/Components/StickyMonthOverlay.swift:147:        DispatchQueue.main.async { [weak self] in
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosDesign/Sources/GastosDesign/Components/AccordionScrollCoordinator.swift:343:             DispatchQueue.main.async { [weak self] in
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosDesign/Sources/GastosDesign/Components/AccordionScrollCoordinator.swift:357:                DispatchQueue.main.async {
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/GastosSwiftUIApp 2.swift:561:            .receive(on: DispatchQueue.main)
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/GastosSwiftUIApp 2.swift:787:            .receive(on: DispatchQueue.main)
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/Components/DSToolbar.swift:265:            DispatchQueue.main.async {
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Firebase/FirebaseResponseCache.swift:169:        if DispatchQueue.getSpecific(key: queueKey) != nil {
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Firebase/FirebaseResponseCache.swift:178:        if DispatchQueue.getSpecific(key: queueKey) != nil {
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/ConnectivityStore.swift:16:            DispatchQueue.main.async {
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/GlobalKeyboardManager.swift:32:            DispatchQueue.main.async { [weak self] in
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/GlobalKeyboardManager.swift:40:            DispatchQueue.main.async { [weak self] in
/Users/igorbelchior/Documents/GitHub/Gastos+/GastosSwiftUI/CurrencyFormatting.swift:81:            DispatchQueue.main.async { [weak uiView, weak coordinator = context.coordinator] in
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/BudgetsStore.swift:73:            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/InvitesStore.swift:50:            .receive(on: DispatchQueue.main)
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/InvitesStore.swift:58:            .receive(on: DispatchQueue.main)
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/InvitesStore.swift:236:                    .receive(on: DispatchQueue.main)
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/InvitesStore.swift:263:                    .receive(on: DispatchQueue.main)
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/InvitesStore.swift:303:            .receive(on: DispatchQueue.main)
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/InvitesStore.swift:396:            .receive(on: DispatchQueue.main)
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/AppStore.swift:185:            .receive(on: DispatchQueue.main)
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/TransactionsStore.swift:111:            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/CardsStore.swift:150:            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosApp/Sources/GastosApp/Stores/UserMetaStore.swift:95:                .receive(on: DispatchQueue.main)
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Realtime/TransactionsWriter.swift:79:            DispatchQueue.global().asyncAfter(deadline: .now() + 15.0) {
/Users/igorbelchior/Documents/GitHub/Gastos+/Packages/GastosData/Sources/GastosData/Realtime/LocalSnapshotCache.swift:178:        if DispatchQueue.getSpecific(key: queueKey) != nil {

## Heavy ops in SwiftUI body (heuristic)
(skipped – heuristic regex disabled for stability)
