# Changelog: Operational Profiles + Soft Entity Resolution
# What changed
- Introduced profile-driven triage gating:
  - `strict` (full hard gates)
  - `standard` (operational default)
  - `lenient` (highest tolerance)
- Updated validation hard-stop policy to keep strict blocking only for core safety risks.
- Added soft actor resolution fallback from explicit ticket identity fields (`FirstName/LastName`, email, phone).
- Mapped workspace runtime settings to profile env variable (`TRIAGE_GATING_PROFILE`).
- Updated validation tests for strict vs standard behavior.

# Why it changed
- Real tickets were being blocked by strict first-pass requirements even with clear identity/context in intake text.
- Goal was to reduce operational friction without removing critical safety controls.

# Impact (UI / logic / data)
- UI: no direct UI changes.
- Logic: more practical first-pass flow in `standard`, while preserving strict mode for high-assurance operation.
- Data: no schema change; validation/evidence payload behavior is profile-aware.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/validate-policy.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/runtime-settings.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/validate-policy-gates.test.ts

# Date
- 2026-02-20
