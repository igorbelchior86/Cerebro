# PrepareContext: Autotask Primary, Email Fallback
# What changed
- Updated `PrepareContextService` intake logic for `T...` tickets to try Autotask first (`ticketNumber` query) before using email-ingestion tables.
- Added explicit fallback behavior and logs when Autotask lookup fails (e.g., `404`), then reuses existing email DB/raw fallback path.
- Tracked actual intake source (`autotask` or `email`) during preparation and persisted it in the ticket text artifact metadata.
- Improved `AutotaskClient` query parsing to support real query response shape using `items` (in addition to legacy `records`).
- Added unit tests for Autotask query response parsing and `ticketNumber` lookup.

# Why it changed
- The pipeline previously treated `T...` tickets as email-ingested first, even when Autotask data was available.
- The desired operational model is to use primary system data (Autotask + NinjaOne + IT Glue) and keep email as a resilience fallback only.
- Runtime validation also showed Autotask query endpoints returning `items`, so client parsing needed to support the real response shape.

# Impact (UI / logic / data)
- UI: No visual changes.
- Logic: `PrepareContext` now prioritizes Autotask for `T...` ticket intake and falls back to email only when Autotask lookup fails.
- Data: No schema changes. Existing `tickets_processed`, `tickets_raw`, and `ticket_text_artifacts` are reused.

# Files touched
- `apps/api/src/services/prepare-context.ts`
- `apps/api/src/clients/autotask.ts`
- `apps/api/src/__tests__/clients/autotask.test.ts`
- `tasks/todo.md`
- `wiki/changelog/2026-02-25-preparecontext-autotask-primary-email-fallback.md`

# Date
- 2026-02-25
