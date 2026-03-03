# Title
Mitigate Orphan Global Queue Selection After Permanent Queue Removal

# What changed
- Added a grace-period fallback in `useSidebarState` for deterministic global queue selections (`queue:<id>`).
- When selected queue is absent from active Autotask queue catalog and catalog is available, selection is reset to `all` after 4 seconds.
- Timeout is cleanup-safe: if queue reappears before timeout, fallback is canceled.

# Why it changed
- Previous stabilization fix intentionally preserved deterministic queue selection to avoid transient async source switching.
- This created a residual risk: permanently removed queues could remain selected indefinitely with synthetic labels.

# Impact (UI / logic / data)
- UI: avoids indefinite orphan queue state; gracefully reverts to `All Queues` for removed queues.
- Logic: preserves transient stability while adding bounded recovery for permanent removals.
- Data: no persistence/schema impact.

# Files touched
- apps/web/src/features/chat/sidebar/useSidebarState.ts
- wiki/changelog/2026-03-03-sidebar-global-queue-orphan-selection-mitigation.md

# Date
2026-03-03
