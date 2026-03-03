# Title
Login alias MASTER + password reset self-service

# What changed
- Backend auth login now accepts `MASTER` as an email alias and maps it to `PLATFORM_MASTER_EMAIL`.
- Added `POST /auth/password/reset-request` (generic `202` response, token generation, audit, optional email send).
- Added `POST /auth/password/reset-confirm` (token validation, one-time consume, password update, audit).
- Added mailer support for password-reset email dispatch.
- Added DB migration `018_user_invites_password_reset_type.sql` to allow `invite_type='password_reset'`.
- Added web page `/[locale]/reset-password` with request + confirm forms.
- Added “Forgot password?” link and MASTER hint in login screen.

# Why it changed
- Operators were unable to authenticate when using `MASTER` as credential identifier.
- User account `igor@refreshtech.com` needed a recoverable password flow without manual DB edits.

# Impact (UI / logic / data)
- UI: login now exposes recovery entrypoint and dedicated reset screen.
- Logic: auth layer now supports alias normalization + secure reset lifecycle using expiring one-time token.
- Data: `user_invites.invite_type` now permits `password_reset`; reset requests create short-lived invite rows and mark them consumed on completion.

# Files touched
- `apps/api/src/services/application/route-handlers/auth-route-handlers.ts`
- `apps/api/src/services/identity/mailer.ts`
- `apps/api/src/db/migrations/018_user_invites_password_reset_type.sql`
- `apps/web/src/app/[locale]/login/page.tsx`
- `apps/web/src/app/[locale]/reset-password/page.tsx`
- `tasks/todo.md`

# Date
2026-03-03
