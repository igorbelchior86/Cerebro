# Hydration Recency Priority and Live Sidebar Reorder
# What changed
- Updated workflow inbox hydration candidate ordering to prioritize recent tickets first.
- Missing-field candidates are now sorted by `created_at` (fallback `updated_at`) descending before round-robin batch selection.
- Added live sidebar reorder animation (FLIP-style) so cards move smoothly during auto-update polling when canonical data updates their sort order.

# Why it changed
- With large backlogs, users focus on the newest tickets; uniform candidate ordering delayed visible quality improvements.
- Sidebar previously jumped abruptly when ticket ordering changed after hydration.

# Impact (UI / logic / data)
- UI: smoother, animated card reordering during polling updates.
- Logic: recent tickets hydrate sooner while keeping fairness for the rest of the backlog via round-robin.
- Data: no schema changes.

# Files touched
- `apps/api/src/services/orchestration/ticket-workflow-core.ts`
- `apps/web/src/features/chat/sidebar/ChatSidebar.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-04
