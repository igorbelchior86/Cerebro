# Autotask Auth Lockout Mitigation and Env Credential Policy

# What changed
- Added a centralized env-credential policy helper to allow env credential usage only for `admin@cerebro.local` (or `PLATFORM_MASTER_EMAIL` override).
- Updated Autotask route handlers to require this policy before any env fallback.
- Updated ticket-intake Autotask sidebar client resolution to use the same policy.
- Removed env fallback from tenant workflow runtime (`getTenantAutotaskClient` now fails closed without DB credentials).
- Hardened Autotask poller:
  - no env fallback in poll context credential resolution,
  - auth-failure cooldown gate (`auth_cooldown_active` / `auth_cooldown_entered`) to stop repeated 401 loops.
- Hardened integration credential save flow:
  - masked placeholders (`••••`) are ignored,
  - updates merge with existing stored credentials,
  - required credential fields are validated after merge.
- Updated Settings UI save logic to avoid sending masked placeholder values.
- Added/updated tests for:
  - env credential policy,
  - poller auth cooldown,
  - masked credential persistence behavior,
  - Autotask sidebar route fallback with master actor context.

# Why it changed
- Repeated Autotask authentication failures can lock API users when retries continue with invalid or corrupted credentials.
- Masked placeholder values were being persisted in some update paths, causing downstream authentication failures.
- Multi-tenant safety requires strict prevention of global env credential usage by tenant-scoped flows.

# Impact (UI / logic / data)
- UI:
  - Settings integration save no longer re-submits masked secrets/codes.
- Logic:
  - Env credential usage is now policy-gated to master account only.
  - Poller avoids repeated auth retries by entering cooldown on auth failures.
  - Workflow runtime and poller now fail closed when tenant DB credentials are unavailable.
- Data:
  - Credential rows are now merged safely; masked placeholders do not overwrite real secrets.

# Files touched
- `apps/api/src/services/identity/env-credential-policy.ts`
- `apps/api/src/services/application/route-handlers/autotask-route-handlers.ts`
- `apps/api/src/services/application/route-handlers/ticket-intake-route-handlers.ts`
- `apps/api/src/services/orchestration/workflow-runtime.ts`
- `apps/api/src/services/adapters/autotask-polling.ts`
- `apps/api/src/services/application/route-handlers/integrations-route-handlers.ts`
- `apps/web/src/components/SettingsModal.tsx`
- `apps/api/src/__tests__/services/env-credential-policy.test.ts`
- `apps/api/src/__tests__/services/autotask-polling.test.ts`
- `apps/api/src/__tests__/routes/integrations.credentials.test.ts`
- `apps/api/src/__tests__/routes/autotask.sidebar-tickets.test.ts`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-05
