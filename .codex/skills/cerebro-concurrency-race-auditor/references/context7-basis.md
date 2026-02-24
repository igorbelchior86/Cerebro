# Context7 Documentation Basis

This skill was grounded with Context7 documentation lookups on 2026-02-24.

## Node.js (`/nodejs/node`)

Focus used:

- `AsyncLocalStorage.run(...)` defines the context boundary.
- Store access (`getStore()`) is only guaranteed inside the callback chain created from `run(...)`.
- Async callbacks created inside the `run(...)` scope inherit the store; code outside does not.

Why it matters here:

- `apps/api/src/lib/tenantContext.ts` and `apps/api/src/db/pool.ts` rely on `AsyncLocalStorage` for tenant/RLS behavior.
- Background execution and timer-driven flows must preserve the expected tenant context, or explicitly set/bypass it.

## PostgreSQL (`/websites/postgresql_16`)

Focus used:

- Row-locking clauses (`FOR UPDATE`, related lock strengths).
- `NOWAIT` / `SKIP LOCKED` for competing workers.
- `SELECT ... FOR UPDATE` to prevent concurrent modification races on selected rows.

Why it matters here:

- Multiple async actors can target the same `triage_sessions`/artifact rows.
- Multi-worker-safe processing usually requires atomic updates and, for queue-like selection, row-locking or equivalent coordination.

## Usage Guidance

Do not cite this file as proof of a bug. Use it as the standards basis for reviewing and designing fixes.

