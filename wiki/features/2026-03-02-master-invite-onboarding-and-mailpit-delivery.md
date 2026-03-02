# Master Invite Onboarding + Mailpit Delivery
# What changed
- Implemented invite email delivery via SMTP in local development.
- Master inviter (`admin@cerebro.local` by default) now creates onboarding invite for a new tenant owner in `/auth/invite`.
- Owner inviter keeps regular coworker invitation flow in same tenant.

# Why it changed
- Match requested simulation:
- master onboarding new tenant
- owner inviting teammates
- Ensure invite is delivered to local inbox instead of only returning token/link.

# Impact (UI / logic / data)
- UI:
- Invite works without generic error and emails are visible at Mailpit (`http://localhost:8025`).
- Logic:
- Branching invite semantics by inviter identity (master vs tenant owner/admin).
- Data:
- New tenants created through master invite onboarding flow.
- Invite role constraint now accepts `owner`.

# Files touched
- `apps/api/src/services/application/route-handlers/auth-route-handlers.ts`
- `apps/api/src/services/identity/mailer.ts`
- `apps/api/src/db/migrations/017_user_invites_allow_owner_role.sql`
- `docker-compose.yml`
- `scripts/stack.sh`
- `env.example`

# Date
- 2026-03-02

