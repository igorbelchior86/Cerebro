# Changelog: Sidebar Right Phone Provider Replaces SLA
# What changed
- Replaced the right-sidebar `SLA` context card with `Phone Provider`.
- Reordered the bottom context cards to:
- `User device` | `Phone Provider`
- `History` | `Refinement`
- Added `phone_provider_name` to the local `SessionData.ssot` typing in the page component.

# Why it changed
- `SLA` was redundant in the sidebar card set.
- `Phone Provider` provides more useful context for network triage workflows.

# Impact (UI / logic / data)
- UI: Context grid content and ordering changed.
- Logic: Unchanged.
- Data: Uses existing `ssot.phone_provider_name` if present, otherwise `Unknown`.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `wiki/features/sidebar-right-phone-provider-card-replaces-sla.md`

# Date
- 2026-02-24

