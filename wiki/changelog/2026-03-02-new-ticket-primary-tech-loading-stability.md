# New Ticket Primary Tech Loading Stability
# What changed
- Updated context-editor search effect in `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`.
- When typed selector suggestions already exist locally (empty query), UI now keeps `contextEditorLoading=false` and renders the suggestion list immediately.
- Remote hydration for full technician list still runs, but in background (without overriding foreground list with spinner state).
- Empty-query hydration delay changed from `320ms` to `0ms`.
- Effect dependency list was narrowed to required reactive inputs to reduce churn/restart cycles.

# Why it changed
- Users still observed "Searching Autotask" for most of the modal lifetime, with brief suggestion flicker.
- Root cause was coupling foreground loading state to background hydration plus frequent effect restarts from broad dependencies/timer behavior.

# Impact (UI / logic / data)
- UI: Primary tech selector stays usable with visible options instead of spinner dominance.
- Logic: Background refresh remains active, but no longer monopolizes modal loading state when cache exists.
- Data: No persistence/schema/API contract changes.

# Files touched
- apps/web/src/app/[locale]/(chat)/triage/home/page.tsx

# Date
- 2026-03-02
