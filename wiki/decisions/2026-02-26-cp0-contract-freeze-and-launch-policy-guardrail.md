# Title
CP0 Contract Freeze Naming and Launch Policy Guardrail Decision

# What changed
- Frozen shared contracts were added with `CP0*` prefixes (for example `CP0CommandEnvelope`, `CP0EventEnvelope`, `CP0AuditRecord`) instead of reusing existing P0 trust-layer names already present in `packages/types/src/index.ts`.
- Launch integration policy was encoded as a hard guardrail map in `apps/api/src/platform/policy.ts`:
  - `autotask` = `two_way`
  - `itglue` = `read_only`
  - `ninja` = `read_only`
  - `sentinelone` = `read_only`
  - `checkpoint` = `read_only`
- Read-only mutation attempts now produce typed rejections (`ReadOnlyIntegrationMutationError`) and audited rejection records.

# Why it changed
- Prefixing avoids type collisions with pre-existing P0 trust-layer contracts in the repo and allows a deterministic CP0 freeze without refactoring unrelated code.
- A central policy guardrail is required by launch policy and must be enforceable before Agents B/C implement integration/business behavior.

# Impact (UI / logic / data)
- UI: None.
- Logic: Write attempts to non-Autotask integrations can be rejected consistently and audited before adapter execution.
- Data: Audit record schema/contracts are standardized for policy decision events.

# Files touched
- `packages/types/src/cp0-contracts.ts`
- `apps/api/src/platform/policy.ts`
- `apps/api/src/platform/errors.ts`
- `apps/api/src/platform/audit-trail.ts`
- `apps/api/src/__tests__/platform/policy-audit.test.ts`

# Date
2026-02-26
