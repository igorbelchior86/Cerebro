# Title
Changelog: ITGlue/NinjaOne Error Taxonomy and Retryability
# What changed
- Introduced shared typed integration error taxonomy in `@cerebro/integrations` (`auth`, `rate_limit`, `timeout`, `validation`, `provider_error`, `unknown`).
- ITGlue and NinjaOne clients now emit normalized typed errors with `statusCode` + `retryable`.
- ITGlue fallback logic replaced string parsing (`message.includes('404')`) with typed status-based fallback.
- Added timeout handling with `AbortSignal.timeout(...)` in both clients.
- Queue error classifier updated to map typed integration errors directly.
- Added tests validating 401/403, 429, timeout, and 5xx mappings.

# Why it changed
- To guarantee deterministic external failure handling across integrations and consumer layers.
- To remove brittle string-based parsing and duplicate classification rules.

# Impact (UI / logic / data)
- UI: none.
- Logic: standardized integration error handling and retryability mapping.
- Data: none (no migration).

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
