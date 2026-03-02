# Auth Control Plane + Tenant-Scoped SAML Boundary
# What changed
- Introduced explicit control-plane onboarding boundary via `/platform/admin/*`.
- Kept tenant RBAC and workspace APIs separate from platform provisioning APIs.
- Added tenant-scoped SAML configuration and ACS processing paths under `/auth/saml/*`.
- Added signed RelayState + request replay guard data model to tie SP-init request to ACS response safely.
- Preserved local JWT session issuance as final runtime identity context after SAML assertion validation.

# Why it changed
- Identity/bootstrap responsibilities were mixed with tenant auth routes and env-driven seeding.
- Enterprise MSP tenants require optional SAML while preserving strict tenant isolation and auditability.
- Security posture requires deterministic no-JIT behavior and replay-resistant callback handling.

# Impact (UI / logic / data)
- UI:
- Login entry can initiate SAML redirect flow per tenant/provider.
- Logic:
- Control-plane and tenant-plane responsibilities are explicitly separated.
- SAML assertions are validated before local session materialization.
- No JIT provisioning: only pre-existing tenant users can authenticate via SAML.
- Data:
- New SAML provider table and replay guard table under tenant partitioning + RLS.
- Invite lifecycle model expanded to support activation semantics and revocation/consumption tracking.

# Files touched
- `apps/api/src/services/application/route-handlers/platform-admin-route-handlers.ts`
- `apps/api/src/services/application/route-handlers/auth-saml-route-handlers.ts`
- `apps/api/src/services/identity/saml-service.ts`
- `apps/api/src/services/identity/security-utils.ts`
- `apps/api/src/db/migrations/015_auth_hardening_and_platform_admin.sql`
- `apps/api/src/db/migrations/016_tenant_saml_providers.sql`
- `apps/api/src/index.ts`

# Date
- 2026-03-02

