# Title
ITGlue/NinjaOne External Error Taxonomy Unification
# What changed
- Added a shared typed error model in `packages/integrations/src/errors.ts`:
  - codes: `auth`, `rate_limit`, `timeout`, `validation`, `provider_error`, `unknown`
  - metadata: `integration`, `operation`, `statusCode`, `retryable`
- Refactored ITGlue client (`packages/integrations/src/itglue/client.ts`) to:
  - normalize all external failures through shared typed errors
  - apply request timeout with `AbortSignal.timeout`
  - replace `Error.message` parsing (`includes('404')`) with typed status check (`statusCode === 404`) in fallback paths
- Refactored NinjaOne client (`packages/integrations/src/ninjaone/client.ts`) to:
  - normalize auth/API/V2 failures through shared typed errors
  - apply request timeout with `AbortSignal.timeout`
  - make fallback paths explicit and status-based (404 only)
- Updated queue consumer classification (`packages/platform/src/errors.ts`) to consume typed integration taxonomy directly, avoiding string parsing for integration failures.
- Added tests for critical scenarios:
  - `apps/api/src/__tests__/clients/integration-client-errors.test.ts`
  - `apps/api/src/__tests__/platform/integration-error-classification.test.ts`

# Why it changed
- Previous behavior depended on textual `Error.message` parsing and inconsistent ad-hoc messages between integration clients.
- The new typed taxonomy creates one deterministic mapping for external failures and retryability, reducing drift across routes/services/workers.
- Status-based fallback guards prevent false positives from message text changes and keep behavior stable across providers.

# Impact (UI / logic / data)
- UI: no direct UI contract change.
- Logic:
  - external client errors are now predictable and typed for ITGlue and NinjaOne
  - retryability and classification are explicit and centralized
  - consumer queue classification now maps integration taxonomy without free-form string parsing
- Data: no schema/migration changes.

# Files touched
- `packages/integrations/src/errors.ts`
- `packages/integrations/src/itglue/client.ts`
- `packages/integrations/src/ninjaone/client.ts`
- `packages/integrations/src/index.ts`
- `packages/integrations/package.json`
- `packages/platform/src/errors.ts`
- `apps/api/src/__tests__/clients/integration-client-errors.test.ts`
- `apps/api/src/__tests__/platform/integration-error-classification.test.ts`
- `tasks/todo.md`

# Date
- 2026-03-02
