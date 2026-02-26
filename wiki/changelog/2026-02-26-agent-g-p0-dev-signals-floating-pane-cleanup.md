# Agent G P0 Dev Signals Floating Pane Cleanup
# What changed
Refactored the tri-pane ticket screen to move P0 development/validation instrumentation into a contextual floating pane (toggle button in the bottom-right corner). Removed shorthand/debug-style elements from the canonical UI and replaced them with human-readable labels inside the floating pane.
# Why it changed
To preserve the existing Cerebro tri-pane UX as the canonical operator interface while keeping admin/dev validation tools available during P0 development.
# Impact (UI / logic / data)
UI: Reduced clutter in the tri-pane workflow; internal P0 tools moved off-canvas into an overlay. Logic/Data: No backend changes; no new write affordances; read-only integration messaging remains enforced and clearer.
# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md
# Date
2026-02-26
