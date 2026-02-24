# Sidebar Right Phone Provider Card Replaces SLA
# What changed
- Removed the redundant `SLA` card from the right sidebar context grid in the triage detail page.
- Added a new `Phone Provider` card using `ssot.phone_provider_name`.
- Kept the requested layout order:
- `User device` | `Phone Provider`
- `History` | `Refinement`
- Updated the local `SessionData.ssot` TypeScript type to include `phone_provider_name`.

# Why it changed
- The `SLA` card was redundant in this context.
- `Phone Provider` adds more operationally useful network context for triage.
- The new order improves scanability for device/network context before pipeline metadata cards.

# Impact (UI / logic / data)
- UI: Right sidebar context cards now show `Phone Provider` instead of `SLA`.
- Logic: No business logic changes.
- Data: Reads existing `ssot.phone_provider_name` field with `Unknown` fallback.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`

# Date
- 2026-02-24

