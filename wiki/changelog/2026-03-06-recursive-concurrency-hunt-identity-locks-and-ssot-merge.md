# Recursive Concurrency Hunt: Identity Locks, Slug Retries, and Atomic SSOT Merge
# What changed
- Fixed tenant-scoped full-flow session resolution in the playbook route so one tenant cannot reuse another tenant's session for the same ticket id.
- Replaced fake Postgres transaction blocks in auth, platform-admin, and seed flows with real single-client transactions.
- Added a shared advisory-lock guard for global identity creation by normalized email.
- Added retry-based tenant slug allocation so concurrent tenant creation does not fail when another request grabs the base slug first.
- Replaced the Autotask ticket context `ticket_ssot` read-merge-write path with an atomic `jsonb` merge in SQL.
- Added regressions for:
  - playbook tenant session isolation
  - identity transaction boundaries
  - email collision during invite activation
  - tenant slug retry after concurrent conflict
  - atomic `ticket_ssot` merge under concurrent updates

# Why it changed
- The repo still had several real concurrency defects after the previous rounds:
  - cross-tenant session reuse in playbook full-flow
  - `pool.query('BEGIN')` blocks that were not actually transactional
  - duplicate global identities under concurrent onboarding
  - tenant slug races on concurrent tenant creation
  - lost updates when two Autotask context refreshes wrote `ticket_ssot` at the same time
- These defects were reproducible and high-signal, so they were fixed one by one with the required loop: search, fix, test, repeat.

# Impact (UI / logic / data)
- UI:
  - invite activation now fails cleanly with `409` if the e-mail was already claimed by another concurrent flow
  - tenant creation is more stable under concurrent admin actions because slug conflicts retry automatically
- Logic:
  - playbook full-flow session claims are now tenant-scoped
  - auth/platform-admin onboarding paths now use real transaction boundaries
  - global identity creation is serialized per normalized e-mail
  - Autotask SSOT persistence now preserves concurrent field additions instead of letting the last write win
- Data:
  - lower risk of cross-tenant session reuse
  - lower risk of duplicate user identities across tenants
  - lower risk of partial tenant bootstrap records
  - lower risk of `ticket_ssot` field loss during concurrent refreshes

# Files touched
- `apps/api/src/services/application/route-handlers/playbook-route-handlers.ts`
- `apps/api/src/__tests__/routes/playbook.full-flow-stale-ticket.test.ts`
- `apps/api/src/services/application/route-handlers/auth-route-handlers.ts`
- `apps/api/src/services/application/route-handlers/platform-admin-route-handlers.ts`
- `apps/api/src/db/seed-admin.ts`
- `apps/api/src/services/identity/email-lock.ts`
- `apps/api/src/services/identity/tenant-slug.ts`
- `apps/api/src/services/application/route-handlers/autotask-route-handlers.ts`
- `apps/api/src/__tests__/routes/identity-transaction-boundaries.test.ts`
- `apps/api/src/__tests__/routes/autotask.ticket-ssot-merge.test.ts`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-06
