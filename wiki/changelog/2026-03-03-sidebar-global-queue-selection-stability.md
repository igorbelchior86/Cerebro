# Title
Stabilize Global Queue Selection Source in Sidebar

# What changed
- Updated `useSidebarState` queue option derivation to preserve a selected deterministic queue (`queue:<id>`) even when async queue options fluctuate.
- Added a synthetic selected queue option when needed so dropdown state remains coherent during transient catalog/fallback transitions.
- Tightened queue reset logic: fallback to `all` now happens only for invalid non-deterministic selections.

# Why it changed
- The previous logic reset `selectedGlobalQueue` to `all` whenever `queueOptions` changed and temporarily excluded the selected queue.
- This caused async state race behavior in UI: data source switched mid-flow between direct global queue tickets and pipeline fallback tickets.

# Impact (UI / logic / data)
- UI: Prevents sudden queue selection jumps in Global scope.
- Logic: Keeps direct global queue source stable for deterministic queue selections.
- Data: No schema/storage changes.

# Files touched
- apps/web/src/features/chat/sidebar/useSidebarState.ts
- wiki/changelog/2026-03-03-sidebar-global-queue-selection-stability.md

# Date
2026-03-03
