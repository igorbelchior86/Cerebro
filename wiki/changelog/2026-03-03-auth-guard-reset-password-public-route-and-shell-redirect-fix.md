# Title
Auth guard hotfix: reset-password public route + shell unauth redirect

# What changed
- Added `/reset-password` to web middleware `PUBLIC_PATHS`.
- Fixed profile dropdown logout to call `${NEXT_PUBLIC_API_URL}/auth/logout` with `credentials: include`.
- Added shell fallback in `ResizableLayout`: when `auth/me` resolves to no user, redirect to `/login`.

# Why it changed
- Users reported bypass/stuck behavior where the app opened directly in triage shell and did not reliably return to login state.
- Password reset screen was being blocked by auth middleware for unauthenticated users.
- Logout path could leave stale auth state due inconsistent endpoint call.

# Impact (UI / logic / data)
- UI: unauthenticated users can open `/en/reset-password`; invalid/no session users are redirected to login instead of staying in shell.
- Logic: route guard and shell auth-state handling are now consistent with backend session validity.
- Data: no persistence schema changes.

# Files touched
- `apps/web/src/middleware.ts`
- `apps/web/src/components/UserProfileDropdown.tsx`
- `apps/web/src/components/ResizableLayout.tsx`
- `tasks/todo.md`

# Date
2026-03-03
