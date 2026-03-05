# Autotask Shared Auth Cooldown Guard
# What changed
- Added a shared authentication-failure cooldown in `AutotaskClient` (`packages/integrations/src/autotask/client.ts`) keyed by principal (`username + integration code`).
- On `401` (and auth-indicative `403`/lock responses), the client now enters cooldown and short-circuits subsequent calls before reaching Autotask.
- Added test-only reset hook `AutotaskClient.__resetAuthFailureCooldownForTests()` to avoid cross-test static state.
- Added regression test in `apps/api/src/__tests__/clients/autotask.test.ts` proving a second immediate request after `401` is blocked locally and does not call provider again.

# Why it changed
- Incident: credentials were being locked due to repeated authentication attempts from different runtime paths.
- Poller already had cooldown, but UI/read paths still attempted provider auth repeatedly.
- A client-level guard ensures one consistent behavior across poller + routes + any consumer of `AutotaskClient`.

# Impact (UI / logic / data)
- UI: read endpoints may return auth-cooldown failures faster instead of repeatedly waiting on provider auth failures.
- Logic: reduced repeated auth attempts after first confirmed auth failure for same principal.
- Data: no schema/migration changes.

# Files touched
- `packages/integrations/src/autotask/client.ts`
- `apps/api/src/__tests__/clients/autotask.test.ts`
- `tasks/todo.md`

# Date
- 2026-03-05
