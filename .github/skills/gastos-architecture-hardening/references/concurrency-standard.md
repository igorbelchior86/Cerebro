# Concurrency Standard

## Rule
- Prefer async/await for new work.
- If legacy callbacks exist, isolate them behind async wrappers in services/adapters.
- UI updates via `@MainActor`.
- Support cancellation.

## SwiftUI guidance
- View calls `Task { await vm.handle(...) }`.
- VM methods are `@MainActor` unless doing CPU-heavy work (then hop off-main and return results).
- No `DispatchQueue.main.asyncAfter` for flow timing; use `Task.sleep`.
