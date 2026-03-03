# Title
Login no longer hangs on endless "Please wait" when API/proxy is unstable

# What changed
- Added client-side timeout wrapper for login requests (`/auth/login` and `/auth/mfa/validate`) in login page.
- Added safe JSON parsing in login page to avoid hard failure on non-JSON/empty responses.
- Added timeout for `useAuth` `/auth/me` bootstrap fetch to guarantee `loading=false` even when backend hangs.

# Why it changed
- When API/proxy was unstable (`socket hang up` / terminated DB connections), browser fetch could stay pending long enough to appear as infinite loading on auth flows.

# Impact (UI / logic / data)
- UI: login now fails fast with error banner instead of infinite "Please wait".
- Logic: auth bootstrap (`useAuth`) no longer risks indefinite loading state.
- Data: no DB schema or auth token contract changes.

# Files touched
- `apps/web/src/app/[locale]/login/page.tsx`
- `apps/web/src/hooks/useAuth.ts`
- `tasks/todo.md`

# Date
2026-03-03
