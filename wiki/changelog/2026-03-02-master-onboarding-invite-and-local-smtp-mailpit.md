# Master Onboarding Invite + Local SMTP (Mailpit)
# What changed
- Added local SMTP email delivery for invite flows using Nodemailer.
- Added Mailpit service to local stack (`docker-compose`) with UI/API on `:8025` and SMTP on `:1025`.
- Updated `POST /auth/invite` behavior:
- if inviter email is `PLATFORM_MASTER_EMAIL` (default `admin@cerebro.local`), treat invite as tenant onboarding:
  - create new tenant derived from invited email domain
  - create activation invite with `role=owner`
- otherwise keep tenant team invite behavior (`admin/member`) for coworkers.
- Added migration to allow `owner` role in `user_invites` check constraint.

# Why it changed
- The requested operating model is:
- master account performs onboarding of new tenants (owner invitation).
- tenant owner invites coworkers in the tenant context.
- Local simulation needs actual email delivery without external SMTP dependency.

# Impact (UI / logic / data)
- UI:
- Team invite now succeeds for both scenarios and can be validated in Mailpit inbox.
- Logic:
- Invite route has explicit branch for platform-master onboarding semantics.
- Invite email is actually sent (when SMTP enabled).
- Data:
- New migration updates invite-role constraint to include `owner`.
- New tenant rows are created during master onboarding invites.

# Files touched
- `apps/api/src/services/application/route-handlers/auth-route-handlers.ts`
- `apps/api/src/services/application/route-handlers/platform-admin-route-handlers.ts`
- `apps/api/src/services/identity/mailer.ts`
- `apps/api/src/db/migrations/017_user_invites_allow_owner_role.sql`
- `apps/api/package.json`
- `docker-compose.yml`
- `scripts/stack.sh`
- `env.example`

# Date
- 2026-03-02

