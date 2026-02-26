# Agent G P0 Dev Signals Floating Pane (Tri-Pane UX Cleanup)
# What changed
Moved P0 admin/dev validation UI elements out of the canonical tri-pane workflow experience and into a ticket-contextual floating pane opened by a bottom-right floating button in `triage/[id]`. The moved items include the shorthand launch-policy badge, workflow runtime + P0 trust signals strip, and internal validation harness links. Labels inside the floating pane were rewritten to human-readable language.
# Why it changed
The canonical Cerebro tri-pane UI must remain the primary operator experience. The P0 validation signals are useful for admin/dev work during development, but they were too visible and noisy in the main workflow UI.
# Impact (UI / logic / data)
UI: Cleaner canonical tri-pane interface; admin/dev signals are available on demand via floating pane. Logic/Data: No backend changes; existing P0 workflow/manager-ops data fetching and ticket-scoped signal derivation are reused.
# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md
# Date
2026-02-26
