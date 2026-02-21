# Device Resolution User Last-Login Priority
# What changed
- Device selection now prioritizes NinjaOne last logged-in user correlation with ticket actor identity.
- Hostname/config correlation moved to fallback path only.
- Raised fallback minimum device selection threshold (`0.20` -> `0.35`).
- Added regression test ensuring user-last-login match wins over weak config-only hints.

# Why it changed
- To prevent false-positive device resolution when only weak infrastructure hints are present.

# Impact (UI / logic / data)
- UI: no direct visual changes.
- Logic: more accurate user-to-device deterministic resolution.
- Data: higher confidence device evidence in context pack.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/prepare-context-device-resolution.test.ts

# Date
- 2026-02-21
