# 2026-02-21 NinjaOne Last Login Endpoint Correlation Fix
# What changed
- Added official NinjaOne last-login API integration in the client.
- Added report fallback for logged-on users query.
- Added fallback for device details endpoint shape (`/v2/device/{id}`).
- Switched prepare-context matching flow to call last-login endpoint before details-based parsing.
- Kept weak correlation guardrails intact.

# Why it changed
- Device resolution for ticket `T20260220.0018` remained `unknown` after removing weak generic device promotion because last-login evidence was never being fetched from the official source.

# Impact (UI / logic / data)
- UI: Endpoint fields can populate with stronger user/device binding.
- Logic: User-to-device matching now follows NinjaOne official API contract.
- Data: Fewer false positives from weak hostname/config hints; improved chance to resolve correct endpoint when last-login is available.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/clients/ninjaone.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/prepare-context-device-resolution.test.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/wiki/features/ninjaone-last-login-endpoint-in-device-correlation.md`

# Date
- 2026-02-21
