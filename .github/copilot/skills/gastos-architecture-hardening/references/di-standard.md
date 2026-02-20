# DI Standard (Enterprise)

## Rule
- Protocols live in Domain/Core.
- Concrete implementations live in Data/Sync.
- Wiring happens **only** in the Composition Root (App container).
- Views never instantiate services directly.

## Recommended shape (Swift/SwiftUI)
- `AppContainer`: owns long-lived services and factories.
- `Factory`: `makeSettingsViewModel()`, `makeHomeViewModel()`, etc.
- ViewModels depend on protocols only.

## Review checklist
- No `Service()` constructed inside a `View`.
- No vendor SDK types cross the boundary into ViewModels; wrap them.
- Constructors take explicit deps (no hidden singletons).
