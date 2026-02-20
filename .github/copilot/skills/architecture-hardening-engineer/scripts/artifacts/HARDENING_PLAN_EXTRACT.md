# HARDENING PLAN EXTRACT

## Plan (ordered)
1) Enforce UI→App boundary  
   - Scope: Remove GastosData/Firebase imports from GastosSwiftUI; expose UI-ready protocols/factories in GastosApp.  
   - Acceptance: `rg "import GastosData" GastosSwiftUI` yields only the composition root; SettingsViewModel/Profile flows depend on protocols with fakes in tests.  
   - Tests: Add mocks for new services and unit-test SettingsViewModel/Profile flows without Firebase.

2) Extract bootstrap pipeline off-main  
   - Scope: Move auth resolution, dataUid/profile resolution, store loading, realtime start into a non-main actor/service in GastosApp; deduplicate the current copy/paste.  
   - Acceptance: AppController methods become thin UI facades; bootstrap service has a single implementation and runs I/O off-main (instrumented in tests).  
   - Tests: Add async tests for bootstrap happy/error paths and dataUid change handling.

3) Model ContentView state & widget sync  
   - Scope: Introduce `ContentCoordinator/DashboardViewModel` with modeled state enums and widget sync API; move recurrence/widget/memoized balance logic out of the view.  
   - Acceptance: ContentView holds ≤10 `@State` vars (mostly routing); widget sync/service lives outside the view and is cancellable on logout/profile change.  
   - Tests: Add VM tests for widget sync retries and memoized balance calculations.

4) Make stores async-friendly  
   - Scope: Remove `@MainActor` from network calls in AppStore/TransactionsStore/CardsStore/BudgetsStore; perform I/O off-main and publish on main.  
   - Acceptance: Store `load`/write methods can be awaited from background without main-thread hops except for state mutation; traces show no blocking prints.  
   - Tests: Concurrency tests asserting store loads complete without `Thread.isMainThread` work; keep existing golden tests green.

5) Contain toast rendering to the overlay  
   - Scope: Introduce `ToastPresenter` as a lightweight environment value, host `ToastView` inside `ToastOverlayWindow`, keep only that overlay observing `ToastManager.currentToast`, and update every sheet/view-model to call `toastPresenter.show` instead of pulling in the observable manager. Simplify the toast visuals to a solid capsule (no blur/shadow) to keep GPU work minimal.  
   - Acceptance: `rg "@Environment(ToastManager.self)"` now only hits the toast overlay files and `rg "toastManager.show" GastosSwiftUI/*.swift` is empty outside of `Components`; the overlay window attaches/detaches with the AppShell lifecycle, so toasts still trigger without requiring `await` yet the main view tree stays untouched and FPS stays ≥50 during updates.  
   - Tests: Profile the home tab while firing a toast to confirm the main-thread work dropped significantly; add a smoke test that calls the new presenter from `SettingsViewModel` and ensures toasts appear through the overlay.  
6) Stop duplicate budget deductions for legacy data  
   - Scope: Prevent `BudgetEngine.generateTechnicalEvents(GastosCore/Engine/BudgetEngine.swift)` from emitting a second reserve/release pair when the transaction feed already contains those historical entries. This might mean checking for `tx.id == "tech-reserve-\(cycle.cycleId)"`/`tech-release`, preserving the `cycle.budgetTag`, or flagging legacy snapshots before generation.  
   - Acceptance: Running `UnifiedBalanceEngine.compute` against `gastosweb-e7356-default-rtdb-export.json` accounts with active budgets no longer shows the bucket hitting both the reserve and the projected balance; new/fresh accounts still receive the injected events.  
   - Tests: Add a regression test that replays the legacy JSON (or a trimmed reproduction) through `UnifiedBalanceEngine` both before and after the guard, verifying that projected balance deltas align and that `generateTechnicalEvents` short-circuits when matching IDs exist.
