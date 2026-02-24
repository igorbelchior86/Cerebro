# SSOT Phone Provider Name Promotion Fix
# What changed
- Fixed `PrepareContext` SSOT assembly to persist `phone_provider_name` into `ticket_ssot`.
- Added `phone_provider_name` to the backend `TicketSSOT` interface and mapped it from `network.phone_provider_name`.

# Why it changed
- The pipeline could infer the phone provider (e.g. `GoTo Connect`) but the value was not promoted to SSOT.
- UI is SSOT-only for user/company/context fields, so the missing SSOT field caused the right sidebar card to show `Unknown`.

# Impact (UI / logic / data)
- UI: `Phone Provider` card can now display the inferred provider from SSOT after pipeline processing.
- Logic: No UI fallback added; architecture contract preserved (`SSOT` remains the only UI source).
- Data: `ticket_ssot.payload` now includes `phone_provider_name`.

# Files touched
- `apps/api/src/services/prepare-context.ts`

# Date
- 2026-02-24

