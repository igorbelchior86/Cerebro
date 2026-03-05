# Autotask 503 After Secret Rotation Hotfix
# What changed
- Updated Autotask auth cooldown keying to include secret hash (instead of only username + integration code) in `packages/integrations/src/autotask/client.ts`.
- Added explicit cooldown clear on successful `PUT /integrations/credentials/autotask` save in `apps/api/src/services/application/route-handlers/integrations-route-handlers.ts`.
- Added regression tests in `apps/api/src/__tests__/clients/autotask.test.ts`:
  - repeated auth failure still short-circuits while cooldown is active;
  - rotated secret for same principal bypasses stale cooldown and allows immediate retry.

# Why it changed
- Production incident: user rotated Autotask secret and account was unlocked, but `/autotask/queues` still returned 503.
- Root cause: stale auth cooldown persisted for same principal even after secret rotation, blocking valid new credentials until cooldown timeout.

# Impact (UI / logic / data)
- UI: connector recovers immediately after valid secret rotation/save, without waiting for cooldown expiry.
- Logic: cooldown still protects against repeated bad-auth loops, but no longer blocks newly rotated credentials.
- Data: no schema/migration changes.

# Files touched
- `packages/integrations/src/autotask/client.ts`
- `apps/api/src/services/application/route-handlers/integrations-route-handlers.ts`
- `apps/api/src/__tests__/clients/autotask.test.ts`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-05
