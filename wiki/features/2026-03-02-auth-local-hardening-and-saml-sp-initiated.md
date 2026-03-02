# Auth Local Hardening + SAML SP-Initiated (Sem JIT)
# What changed
- Added phase A auth hardening:
- `register-tenant` moved to legacy mode behind `AUTH_ENABLE_LEGACY_REGISTER` (default disabled).
- account activation flow introduced via `POST /auth/activate-account` with one-time hashed invite token.
- invite generation now stores token hash and enforces one-time consumption semantics.
- global email normalization and uniqueness enforcement prepared via migration.
- Added control-plane provisioning endpoints:
- `POST /platform/admin/tenants`
- `POST /platform/admin/tenants/:tenantId/invites`
- Added phase B SAML support (tenant-scoped):
- provider management (`GET/PUT /auth/saml/providers*`)
- SP-initiated start (`GET /auth/saml/:provider/start`)
- ACS callback (`POST /auth/saml/:provider/acs`)
- local SAML logout (`POST /auth/saml/:provider/logout`)
- Added replay guard table and relay-state signing helpers.

# Why it changed
- Remove fragile dependency on `.env` seed account as operational onboarding method.
- Enforce deterministic account lifecycle and auditability for identity operations.
- Enable enterprise SSO option per MSP tenant with strict boundary controls and no JIT provisioning.

# Impact (UI / logic / data)
- UI:
- New activation URL target becomes `/activate-account?token=...`.
- SAML login flow now supports tenant-aware SP-initiated redirect entrypoint.
- Logic:
- Identity onboarding moved to control-plane provisioning.
- Invite lifecycle hardened with token hash/revocation/one-time semantics.
- SAML ACS enforces issuer/audience/inResponseTo/time-window checks and no-JIT user policy.
- Data:
- New migration fields on `user_invites`.
- New tables: `platform_admins`, `tenant_saml_providers`, `saml_request_replay_guard`.
- New global unique index for normalized user email.

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

