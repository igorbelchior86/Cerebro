# Title
Sidebar Left Panel: Global/Personal Toggle with Queue Dropdown (UI-first)

# What changed
- Reduced the visual height of the `Active / Done Today / Avg Time` stat tiles.
- Added a real binary slider (`Personal` / `Global`) using a 2-position range slider (track + thumb) in the lower portion of the stats section, after replacing the initial segmented/toggle attempts.
- `Personal` mode keeps the current top controls for the ticket list (`All / Processing / Done / Failed` + suppressed filter button).
- `Global` mode replaces those controls with a queue dropdown (prepared for Autotask queues).
- Added optional ticket fields in the frontend type (`queue`, `queue_name`, `assigned_resource_*`) so the UI can immediately consume Autotask metadata when the backend starts sending it.
- Added fallback behavior: if queue/assignee metadata is not present yet, the UI keeps showing the current ticket list instead of going empty.

# Why it changed
- The team wants to validate the interaction model (Global vs Personal views) before implementing the full Autotask management layer.
- This de-risks the upcoming backend integration by letting product/UI iterate on the sidebar behavior first.

# Impact (UI / logic / data)
- UI: New scope switcher in the stats card and conditional controls in the ticket list header.
- Logic: Ticket filtering now supports two scopes:
  - `Personal`: filters by assigned technician when assignment metadata exists.
  - `Global`: filters by selected queue when queue metadata exists.
- Data: No backend/API changes yet. Frontend uses optional fields and fallbacks.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatSidebar.tsx`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/messages/en.json`

# Date
2026-02-25
