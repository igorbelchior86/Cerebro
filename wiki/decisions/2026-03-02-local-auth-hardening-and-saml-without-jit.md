# Decision: Local Auth Hardening + SAML (SP-Initiated, Sem JIT)
# What changed
- Formalized identity decisions in implementation:
- local onboarding is controlled by platform admin provisioning surface.
- legacy `register-tenant` remains only as gated compatibility path.
- local identity uses globally unique normalized email.
- SAML is tenant-scoped, SP-initiated only, and denies JIT provisioning.

# Why it changed
- Reduces ambiguous/fragile bootstrap behavior.
- Aligns identity security controls with auditability and tenant isolation requirements.
- Keeps enterprise SSO optional without expanding risk via automatic account creation.

# Impact (UI / logic / data)
- UI:
- Activation and SAML entrypoints are explicit and deterministic.
- Logic:
- Provisioning authority moved to control-plane tokenized endpoints.
- SAML callback requires matching request context + pre-provisioned tenant user.
- Data:
- New identity/SAML tables and invite lifecycle columns.

# Files touched
- `apps/api/src/services/application/route-handlers/auth-route-handlers.ts`
- `apps/api/src/services/application/route-handlers/platform-admin-route-handlers.ts`
- `apps/api/src/services/application/route-handlers/auth-saml-route-handlers.ts`
- `apps/api/src/db/migrations/015_auth_hardening_and_platform_admin.sql`
- `apps/api/src/db/migrations/016_tenant_saml_providers.sql`

# Date
- 2026-03-02

