# Architecture Hardening Report (Enterprise Standard)

Date: 2025-12-30  
Status: Active

## Boundary Map (proposed)
- **GastosSwiftUI (app shell/UI)**: SwiftUI entry point, navigation, screens.  
- **GastosApp (composition + stores)**: AppContainer, stores, notification/queue orchestration, ViewModel factories.  
- **GastosData (data layer)**: Firebase REST/Realtime/Auth, repositories, offline queues, response cache.  
- **GastosDesign (design system)**: SwiftUI components, shaders, tokens, modifiers.  
- **GastosCore (domain)**: Immutable models (Transaction, Budget, DailyBalance, MonthSnapshot, etc.) and domain utilities.  
- **GastosWidget (extension)**: Widgets consuming cached snapshots from the app group.  
- **GastosSync (future)**: Placeholder CloudKit sync surface.  
- **GastosJSBridge**: JS runtime bridge (kept isolated from UI).

**Allowed dependency direction**
- GastosSwiftUI → GastosApp, GastosDesign, GastosCore  
- GastosApp → GastosData, GastosDesign, GastosCore  
- GastosData → GastosCore  
- GastosDesign → GastosCore  
- GastosWidget → GastosCore, GastosApp (via app-group snapshot API)  
- GastosSync → GastosCore  
- GastosCore → (no dependencies)

**Prohibited imports**
- GastosSwiftUI must not import `GastosData` or vendor SDKs (Firebase, GoogleSignIn); only talk to protocols/factories in GastosApp.  
- GastosCore must not import SwiftUI/UIKit or Firebase.  
- GastosData must not import SwiftUI.  
- Widgets must not reach Firebase directly (only app-group cache/service).

**Seam contracts (protocols) to preserve**
- `AuthSession`, `RealtimeServiceProtocol`, `TransactionsRepositoryProtocol`, `CardsRepositoryProtocol`, `BudgetsRepositoryProtocol`, `AppBootstrapRepositoryProtocol`, `BudgetCycleSnapshotsRepositoryProtocol`, `MonthSnapshotsRepositoryProtocol`, `UserPreferencesRepositoryProtocol`, `InvitesRepositoryProtocol`, `UserMetaRepositoryProtocol`, `PublicProfileRepositoryProtocol`, `AccountMergeServiceProtocol`, `AccountDeletionServiceProtocol`.

## Blockers
- GastosSwiftUI depends on GastosData/Firebase directly (violates DI standard). Examples: `GastosSwiftUI/ContentView.swift:8-15` imports GastosData; `GastosSwiftUI/ViewModels/SettingsViewModel.swift:24-78` calls `FirebaseSession.shared`; `GastosSwiftUI/AppShellView.swift:1-40` imports GastosData types. Fix: expose a UI-facing service surface in GastosApp (e.g., `SettingsProfileService`, `AuthSession` wrapper, `WidgetSyncService`), remove GastosData imports from GastosSwiftUI, and pass only protocols from AppContainer/factories.
- Bootstrap pipeline is duplicated and runs network on the main actor. `GastosSwiftUI/GastosSwiftUIApp 2.swift:180-520` (and a duplicated copy later in the same file) performs auth resolution, repository loads, and realtime start under `@MainActor` and uses the same code twice. Fix: move bootstrap/reload/dataUid handling into a non-main `BootstrapPipeline` actor inside GastosApp, keep a single implementation, and have AppController only apply UI state on the main actor.
- ContentView holds 30+ pieces of mutable state and owns widget sync/memoization logic. `GastosSwiftUI/ContentView.swift:30-175` includes recurrence state, widget sync tasks, memoized balance caches, and manual Task bookkeeping, mixing navigation, deep links, and widget writes. Fix: introduce a `ContentCoordinator`/`DashboardViewModel` in GastosApp that models screen state (`struct ScreenState`, enums for flows), owns widget sync/resolved balances, and exposes derived props; reduce ContentView `@State` to routing toggles only.
- Legacy profiles still carry historical “budget reserve” transactions, so `UnifiedBalanceEngine` now deducts the same bucket twice: once through the stored reserve/release entries and once more when `BudgetEngine.generateTechnicalEvents` injects a new `tech-reserve`/`tech-release` pair (`Packages/GastosCore/Sources/GastosCore/Engine/BudgetEngine.swift:160-206`). Fresh data lacks those historical entries, hence no regression there. Fix: detect and skip generation when a matching cycle already has the reserve/release pair (e.g., by preserving a unique event ID/tag or checking `isTechnical`), or add a migration that flags legacy reserves and prevents the duplicate deduction.

## High
- Stores perform network work on the main actor. `AppStore.load` and `updateStartBalance` are `@MainActor` while awaiting Firebase (`Packages/GastosApp/Sources/GastosApp/Stores/AppStore.swift:65-140`); `TransactionsStore.load`/`addOrUpdate` and similar methods in Cards/Budgets stores are also `@MainActor`. This blocks the UI thread during network calls. Fix: split into nonisolated `load`/`persist` methods that hop off-main for I/O, then publish results via `@MainActor` state mutations; add regression tests for main-thread idleness.
- Deep link handling is split across `AppController.pendingDeepLink`, `DeepLinkManager.shared`, and ContentView consumers (`GastosSwiftUI/ContentView.swift:252-370` and `1715+`), leading to double-handling/missed intents. Fix: consolidate into a single `DeepLinkCoordinator` in GastosApp that emits a modeled action stream consumed by AppShell/ContentView; remove global singleton reads from views.
- Toast stack updates were invalidating the entire SwiftUI tree and dropping frames. Because `ToastManager` is `@Observable` and was injected via `@Environment(ToastManager.self)` in every sheet/feature (`ContentView`, `SettingsSheet`, `AddOperationSheet`, `CardsSheet`, `ShareAccountView`, etc.), each call to `toastManager.show` kicked off a full tree refresh. Fix: created `GastosSwiftUI/Components/ToastPresenter.swift`, rerouted callers to the presenter, simplified the toast appearance, and now host the overlay in `GastosSwiftUI/Components/ToastOverlayWindow.swift` so only that UIWindow observes `ToastManager.currentToast` and the SwiftUI tree stays untouched.

## Medium
- Widget sync is orphaned between AppController and ContentView. AppController registers a NotificationCenter observer and a stub `syncWidget` (`GastosSwiftUI/GastosSwiftUIApp 2.swift:600-640`), while ContentView manages `widgetSyncTask`/retry flags. No cancellation on logout/profile change risks stale data in the app group. Fix: create a scoped `WidgetSyncService` in GastosApp keyed by `(dataUid, profileId)` with cancellation on logout/profile switch; views only trigger “sync now” intents.
- Firebase configuration blocks the main thread when invoked off-main. `Packages/GastosData/Sources/GastosData/Firebase/FirebaseSession.swift:15-60` uses `DispatchQueue.main.sync` to configure Firebase, risking UI stalls during cold start. Fix: switch to `await MainActor.run` and guard idempotency with an async lock; add a unit test that configure-if-needed does not block the main thread.

## Low
- Debug prints ship to production. Numerous `print` calls (e.g., `GastosSwiftUI/ContentView.swift:256,367`, `GastosSwiftUI/GastosSwiftUIApp 2.swift:88-115`, `Packages/GastosApp/Sources/GastosApp/Stores/UserMetaStore.swift:129-217`) bypass logging gates. Fix: wrap in `#if DEBUG` or replace with unified logger with levels.

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

## PR Gates
- Automated  
  - Lint: fail if `GastosSwiftUI/**` imports `GastosData`/`Firebase`.  
  - Lint: flag `DispatchQueue.main.asyncAfter` inside SwiftUI/Design; prefer `Task.sleep`.  
  - Concurrency check: forbid `@MainActor` functions awaiting repository/service calls in `Packages/GastosApp/Sources/GastosApp/Stores/**`.  
  - Tests: run SPM test suites for GastosCore, GastosData, GastosApp (including new VM tests).
- Manual review checklist  
  - Boundary direction matches map (UI→App→Data→Core; no back edges).  
  - Bootstrap pipeline lives in one place and runs off-main; AppController only applies UI state.  
  - ContentView state modeled (no boolean soup; widget sync/service not in the view).  
  - Vendor SDK types do not leak past GastosData; widgets read from app-group cache only.***
