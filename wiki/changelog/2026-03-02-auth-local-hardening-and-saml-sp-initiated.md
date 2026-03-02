# 2026-03-02 - Auth Local Hardening + SAML SP-Initiated
# What changed
- Added auth hardening package:
- `POST /auth/activate-account` with one-time hashed invite token consumption.
- global email normalization + uniqueness migration.
- legacy `POST /auth/register-tenant` gated by `AUTH_ENABLE_LEGACY_REGISTER` (default `false`).
- Added platform admin provisioning APIs:
- `POST /platform/admin/tenants`
- `POST /platform/admin/tenants/:tenantId/invites`
- Added tenant-scoped SAML APIs:
- `GET /auth/saml/providers`
- `PUT /auth/saml/providers/:provider`
- `GET /auth/saml/:provider/start`
- `POST /auth/saml/:provider/acs`
- `POST /auth/saml/:provider/logout`
- Added replay guard + RelayState signing utilities and new service tests.

# Why it changed
- Replace env-seed bootstrap as operational auth onboarding path.
- Provide optional enterprise SSO path per MSP with strict validation and tenant boundaries.
- Increase auditability and deterministic identity lifecycle behavior.

# Impact (UI / logic / data)
- UI:
- Account activation flow now points to `/activate-account`.
- Tenant-specific SAML entrypoint can redirect user to IdP.
- Logic:
- Invite lifecycle is one-time/revocable.
- SAML ACS validates assertion constraints and blocks non-provisioned users (no JIT).
- Data:
- New migrations:
- `015_auth_hardening_and_platform_admin.sql`
- `016_tenant_saml_providers.sql`

# Files touched
- `apps/api/src/services/application/route-handlers/auth-route-handlers.ts`
- `apps/api/src/services/application/route-handlers/platform-admin-route-handlers.ts`
- `apps/api/src/services/application/route-handlers/auth-saml-route-handlers.ts`
- `apps/api/src/services/identity/security-utils.ts`
- `apps/api/src/services/identity/saml-service.ts`
- `apps/api/src/routes/platform/admin.ts`
- `apps/api/src/index.ts`
- `apps/api/src/db/seed-admin.ts`
- `apps/api/src/db/migrations/015_auth_hardening_and_platform_admin.sql`
- `apps/api/src/db/migrations/016_tenant_saml_providers.sql`
- `apps/api/src/__tests__/services/security-utils.test.ts`
- `apps/api/src/__tests__/services/saml-service.test.ts`
- `apps/api/package.json`
- `env.example`

# Date
- 2026-03-02

