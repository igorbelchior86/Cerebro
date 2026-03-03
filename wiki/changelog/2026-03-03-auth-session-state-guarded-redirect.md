# Auth Session State Guarded Redirect
# What changed
- Added explicit auth session state handling in `useAuth` (`loading`, `authenticated`, `unauthenticated`, `unavailable`).
- Updated `/auth/me` handling so only `401/403` transitions to `unauthenticated` and clears user.
- Kept session intact on transient failures (`timeout`, network errors, `5xx`) by marking state as `unavailable`.
- Updated `ResizableLayout` redirect logic to send user to `/login` only when session state is explicitly `unauthenticated`.

# Why it changed
- Users were being redirected back to login after a successful sign-in whenever `/auth/me` had an intermittent failure.
- The previous logic treated any fetch failure as logout, causing auth flapping and blocked re-login loops during backend instability.

# Impact (UI / logic / data)
- UI: stops forced logout loops caused by transient auth profile fetch failures.
- Logic: client-side guard now distinguishes invalid session from temporary backend unavailability.
- Data: no schema or persistence changes.

# Files touched
- apps/web/src/hooks/useAuth.ts
- apps/web/src/components/ResizableLayout.tsx

# Date
- 2026-03-03
