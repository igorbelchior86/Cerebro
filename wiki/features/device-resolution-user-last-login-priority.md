# Device Resolution User Last-Login Priority
# What changed
- Updated deterministic device resolver in `PrepareContextService` to prioritize user correlation by NinjaOne last logged-in user before hostname/config heuristics.
- New user-first matching flow:
  - extract actor identity seeds from ticket (`email` + normalized tokens)
  - evaluate candidate devices by `last logged-in user` using direct payload and per-device details lookup
  - select device when user match score is strong (`>= 0.60`)
- Hostname/config strategy remains as fallback only when no strong user match exists.
- Increased fallback minimum hostname/config selection threshold from `0.20` to `0.35` to reduce weak false positives.
- Added regression test to enforce that last-login match wins over weak config-only correlation.

# Why it changed
- Real ticket flow selected an incorrect generic device (`LINNANE-GENERAL`) due weak IT Glue config correlation at the previous low threshold.
- Operational rule is to prioritize affected-user identity match against NinjaOne last login as the most reliable signal.

# Impact (UI / logic / data)
- UI: no direct layout changes.
- Logic: device correlation now follows user-first deterministic strategy, reducing incorrect generic-device selection.
- Data: evidence payload quality improves via stronger device-user linkage; no schema migration.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/prepare-context-device-resolution.test.ts

# Date
- 2026-02-21
