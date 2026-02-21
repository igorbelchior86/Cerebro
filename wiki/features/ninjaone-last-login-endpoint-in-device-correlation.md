# NinjaOne Last Login Endpoint in Device Correlation
# What changed
- Updated NinjaOne client to support official v2 path calls and added:
- `getDeviceLastLoggedOnUser(deviceId)` using `/v2/device/{id}/last-logged-on-user`
- `listLastLoggedOnUsers()` using `/v2/queries/logged-on-users` as fallback source
- Updated device detail retrieval to fallback to `/v2/device/{id}` when `/api/v2/devices/{id}` fails.
- Updated iterative enrichment device resolution to prioritize official last-login data before generic device details parsing.
- Updated round-3 refinement to reuse the same last-login source.
- Updated service test mocks to include new NinjaOne methods.

# Why it changed
- Pipeline was not reaching reliable `user_signed_in` data because last-login was being inferred from generic device details payload and not from NinjaOne's official last-login endpoint.
- In tenant runs, generic details calls could return 404 for IDs coming from org device listing, causing logged-in user resolution to fail.

# Impact (UI / logic / data)
- UI: Endpoint section can now receive stronger `user_signed_in` evidence when NinjaOne provides last-login data.
- Logic: Device selection now relies on official last-login source first, reducing false negatives and avoiding weak hostname-only promotion.
- Data: `source_findings` and iterative enrichment fields reflect stronger identity-device correlation when available.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/clients/ninjaone.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/prepare-context-device-resolution.test.ts`

# Date
- 2026-02-21
