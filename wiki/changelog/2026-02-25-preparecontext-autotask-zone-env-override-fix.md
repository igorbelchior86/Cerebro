# PrepareContext Autotask Zone Env Override Fix
# What changed
- Fixed `PrepareContextService.buildAutotaskClient()` so it does **not** force `AUTOTASK_ZONE_URL` from environment when Autotask credentials come from the UI/database (`integration_credentials`).
- With UI/DB credentials, `PrepareContext` now uses:
  - `creds.zoneUrl` if explicitly stored, or
  - Autotask zone discovery (default client behavior)
- `AUTOTASK_ZONE_URL` env is now only used as fallback when no DB credentials are available.

# Why it changed
- The Autotask poller was successfully reading tickets, but `PrepareContext` failed with `Cannot prepare context without valid ticket from Autotask`.
- Root cause: `PrepareContext` and the poller constructed the Autotask client differently. `PrepareContext` could inject a stale/placeholder env zone URL, causing ticket fetch failures even with valid UI credentials.
- This is critical because it breaks Phase 1 (`Prepare Context`) immediately after the poller detects valid tickets.

# Impact (UI / logic / data)
- UI: No visual changes.
- Logic: `PrepareContext` now uses the same effective zone resolution behavior as the working poller path when credentials come from the UI.
- Data: No schema changes. Existing sessions can resume and proceed past the previous Autotask fetch failure.

# Files touched
- `apps/api/src/services/prepare-context.ts`
- `tasks/todo.md`
- `tasks/lessons.md`
- `wiki/changelog/2026-02-25-preparecontext-autotask-zone-env-override-fix.md`

# Date
- 2026-02-25
