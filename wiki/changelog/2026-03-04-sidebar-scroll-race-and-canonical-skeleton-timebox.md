# Sidebar Scroll Race and Canonical Skeleton Timebox
# What changed
- Added burst-coalescing and in-flight serialization to `usePollingResource` so realtime `ticket.change` events do not fan out concurrent `/workflow/inbox` fetches.
- Disabled realtime auto-refresh for inbox polling on triage detail page (`[id]`) to avoid request storms in this surface.
- Updated sidebar FLIP reorder animation to be scroll-aware:
  - skip card transform animation while user is actively scrolling;
  - ignore extreme deltas that are likely scroll drift, not reorder.
- Updated workflow sidebar adapter to sanitize textual placeholders (`Unknown ...`) into empty canonical-missing values.
- Introduced bounded canonical pending behavior:
  - show per-field skeleton only for recent pending tickets (`canonical_pending`);
  - render stable `—` when fields remain missing outside that pending window.
- Extended `ActiveTicket` type with `canonical_pending`.

# Why it changed
- The UI entered a bad interaction loop:
  - frequent inbox refreshes caused constant list re-layout;
  - FLIP animation applied during scroll fought user wheel/trackpad input;
  - missing canonical identity fields produced effectively permanent skeleton placeholders.

# Impact (UI / logic / data)
- UI: sidebar scroll no longer gets “captured” by reorder animation during active scrolling.
- UI: cards no longer stay in perceived eternal shimmer for missing org/requester.
- Logic: polling pipeline now coalesces realtime-driven refreshes and avoids overlapping fetches.
- Data: no schema migration; runtime/read behavior only.

# Files touched
- `apps/web/src/hooks/usePollingResource.ts`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `apps/web/src/features/chat/sidebar/ChatSidebar.tsx`
- `apps/web/src/features/chat/sidebar/SidebarTicketCard.tsx`
- `apps/web/src/features/chat/sidebar/types.ts`
- `apps/web/src/lib/workflow-sidebar-adapter.ts`
- `tasks/todo.md`

# Date
- 2026-03-04
