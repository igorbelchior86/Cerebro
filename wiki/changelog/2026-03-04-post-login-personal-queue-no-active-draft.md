# Post-login Personal Queue Without Active Draft
# What changed
- Changed `/triage/home` default behavior to neutral inbox mode (no active draft selection).
- Draft compose mode now activates only when bridge is active or `compose=1` is present in URL.
- Updated `New Ticket` action on home to navigate to `/triage/home?sidebarScope=personal&compose=1`.
- Updated post-auth redirects to include `sidebarScope=personal`.
- Updated sidebar state restore to prioritize `sidebarScope` URL parameter over session restore.

# Why it changed
- Users were landing after login with a synthetic `New Ticket` selected by default.
- Required behavior is: start in Personal queue, show user tickets, and keep no active ticket selected.

# Impact (UI / logic / data)
- UI: post-login starts in Personal queue with no selected ticket.
- Logic: compose workspace is now explicit opt-in instead of default-on.
- Data: no schema changes.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `apps/web/src/features/chat/sidebar/useSidebarState.ts`
- `apps/web/src/app/[locale]/(main)/page.tsx`
- `apps/web/src/app/[locale]/register/page.tsx`
- `apps/web/src/app/[locale]/accept-invite/page.tsx`
- `apps/web/src/app/[locale]/activate-account/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-04
