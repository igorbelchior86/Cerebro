# Background Errors Fix: Legacy integrations table + Postgres healthcheck
# What changed
- Updated read-model credential lookup for Autotask, ITGlue, and NinjaOne fetchers to use `integration_credentials` instead of legacy/nonexistent `integrations`.
- Enforced tenant-scoped lookup in these fetchers (`tenant_id + service`) with graceful fallback to `null` on lookup failure.
- Updated Postgres healthcheck command in `docker-compose.yml` from `pg_isready -U playbook` to `pg_isready -U playbook -d postgres`.
- Added regression test coverage for read-model fetcher credential lookup and tenant scoping.

# Why it changed
- Background orchestration was failing with `relation "integrations" does not exist` during context preparation.
- Docker healthcheck spammed Postgres logs with `database "playbook" does not exist` due default DB resolution in `pg_isready`.

# Impact (UI / logic / data)
- UI: indirect stability improvement by preventing background orchestration failures caused by bad credential table lookup.
- Logic: read-model fetchers now follow the same credential source and tenant scoping as the rest of the backend.
- Data: no schema migration; query target and healthcheck command only.

# Files touched
- apps/api/src/services/read-models/data-fetchers/autotask-fetcher.ts
- apps/api/src/services/read-models/data-fetchers/itglue-fetcher.ts
- apps/api/src/services/read-models/data-fetchers/ninjaone-fetcher.ts
- apps/api/src/__tests__/services/read-model-fetchers-credentials.test.ts
- docker-compose.yml

# Date
- 2026-03-03
