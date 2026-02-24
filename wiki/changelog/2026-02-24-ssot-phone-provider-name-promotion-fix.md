# Changelog: SSOT Phone Provider Name Promotion Fix
# What changed
- Persisted `phone_provider_name` in `ticket_ssot` during `PrepareContext` SSOT assembly.
- Updated backend `TicketSSOT` typing and `buildTicketSSOT(...)` mapping to carry `network.phone_provider_name`.

# Why it changed
- A known inferred phone provider was visible in pipeline progress/timeline but missing from SSOT, causing SSOT-only UI cards to render `Unknown`.

# Impact (UI / logic / data)
- UI: Right sidebar `Phone Provider` card now reflects the inferred provider through SSOT.
- Logic: Fix is in pipeline/SSOT promotion (no UI workaround).
- Data: `ticket_ssot.payload.phone_provider_name` is now populated when inferred.

# Files touched
- `apps/api/src/services/prepare-context.ts`
- `wiki/features/ssot-phone-provider-name-promotion-fix.md`

# Date
- 2026-02-24

