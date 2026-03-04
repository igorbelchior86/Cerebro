# Quality Gates

## Gate states
Each gate has three possible states:
- **ON** — triggered; evidence required; must reach PASS before merge.
- **OFF** — trigger condition not met; gate does not apply to this change.
- **N/A** — trigger condition is technically met but the gate is demonstrably irrelevant
  (e.g. a test file referencing `tenant_id` only as a mock value).
  Requires a one-sentence written justification from the primary owner.
  Reliability must acknowledge the N/A before the gate is waived.

## Contract Gate
Triggers when:
- API response changes
- shared type changes
- DB schema changes that affect consumers

Pass criteria:
- versioning or compatibility layer
- contract tests updated
- migration path documented

## Tenant Isolation Gate
Triggers when:
- any code path touches tenant_id scoping, permissions, or routing

Pass criteria:
- explicit tenant scoping in queries and cache keys
- negative tests for cross-tenant access

## Connector Write-Safety Gate
Triggers when:
- writes to Autotask or other systems change
- scopes/auth changes
- rate-limit behavior changes

Pass criteria:
- dry-run / safe mode documented
- idempotency confirmed
- integration tests (mock or sandbox)
- retry/backoff documented

## AI Replay Gate
Triggers when:
- prompts, tools, agent logic, or validation thresholds change

Pass criteria:
- golden cases updated
- replay suite run
- regressions documented and accepted (or fixed)

## Observability Gate
Triggers when:
- runtime behavior changes
- background workers or queues touched

Pass criteria:
- structured logs with correlation id
- success/failure metrics
- traces for external calls (when available)
