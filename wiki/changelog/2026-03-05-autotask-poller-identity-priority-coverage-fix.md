# Autotask poller identity priority and coverage fix
# What changed
- Updated `apps/api/src/services/adapters/autotask-polling.ts` so canonical identity lookup now prioritizes tickets by `createDate` before selecting `company_id` / `contact_id` candidates.
- Raised the bounded identity lookup defaults to match observed provider latency:
  - per-call timeout `2500ms`
  - total lookup budget `8000ms`
  - per-run coverage `10 companies / 10 contacts`
- Added regression coverage in `apps/api/src/__tests__/services/autotask-polling.test.ts` for:
  - live-like company latency,
  - prioritization by `createDate` over `lastActivityDate`,
  - later recent tickets still receiving canonical company/requester data under the default bounds.

# Why it changed
- The remaining `Org` / `Requester` gaps were not only a UI precedence issue.
- The poller was enriching identity candidates in `lastActivityDate` order, while the sidebar renders tickets by `createDate`.
- Under capped lookup coverage, newer visible cards could stay blank while older/high-activity tickets consumed the lookup budget first.
- Real Autotask timings also showed that some company lookups required more than the previous timeout bound.

# Impact (UI / logic / data)
- UI: recent sidebar cards now receive canonical `Org` / `Requester` data for the visible queue order instead of arbitrary activity-priority order.
- Logic: identity enrichment remains bounded, but the bound now covers the actual visible ticket window and matches provider latency.
- Data: no schema or migration changes; workflow runtime is rebuilt with fuller canonical identity fields.

# Files touched
- `apps/api/src/services/adapters/autotask-polling.ts`
- `apps/api/src/__tests__/services/autotask-polling.test.ts`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-05
