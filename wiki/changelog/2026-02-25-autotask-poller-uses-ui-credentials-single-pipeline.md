# Autotask Poller Uses UI Credentials (Single Pipeline)
# What changed
- Updated `AutotaskPollingService` to resolve Autotask credentials from `integration_credentials` (same source used by the UI integrations screen) instead of requiring only `AUTOTASK_*` environment variables.
- Polling now builds the `AutotaskClient` dynamically on each poll cycle, so UI credential updates can be picked up without restarting the app process.
- Kept an env fallback only for bootstrap/backward compatibility when DB credentials are unavailable.

# Why it changed
- The app had two credential paths for Autotask:
- UI health/connection checks used DB-stored credentials.
- Autotask polling used only process env vars.
- This caused a false sense of readiness (`Connected` in UI) while the Autotask poller stayed disabled.
- The change enforces a single practical pipeline for runtime credentials: UI -> `integration_credentials` -> poller/client.

# Impact (UI / logic / data)
- UI: No visual change.
- Logic: Autotask polling now uses workspace/DB credentials configured in the UI.
- Data: No schema changes. Reads from existing `integration_credentials` table.

# Files touched
- `apps/api/src/services/autotask-polling.ts`
- `wiki/changelog/2026-02-25-autotask-poller-uses-ui-credentials-single-pipeline.md`

# Date
- 2026-02-25
