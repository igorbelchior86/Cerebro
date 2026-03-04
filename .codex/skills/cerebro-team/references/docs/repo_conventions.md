# Repo Conventions

Monorepo structure:
- `apps/api`      — Express/Node backend
- `apps/web`      — Next.js frontend
- `packages/types` — shared TypeScript contracts (SSOT)

## Types as contracts
- `packages/types` is the single source of truth for shared contracts.
- Any breaking change to shared types requires the Contract Gate.

## Logging
- JSON structured logs with: `tenant_id`, `correlation_id`, `component`, `action`, `result`
- Correlation IDs must flow across all service boundaries.

## Redis
- Keys must be tenant-scoped.
- Prefer tag-based invalidation — never use KEYS.
- Define degraded mode behavior for when Redis is unavailable.

## Connectors
- Centralize all external calls under a dedicated connector layer.
- Each connector must define: rate-limit policy, retry/backoff strategy, and degraded mode.
