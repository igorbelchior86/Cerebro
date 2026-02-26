# Agent G Decision: Keep P0 Dev Signals Behind Floating Pane in Tri-Pane UX
# What changed
Decision: P0 admin/dev validation signals (launch policy shorthand, workflow/trust strip, internal harness links, and related debug-style statuses) are not rendered inline in the canonical tri-pane workflow UI. They are available only through a contextual floating pane toggled by a bottom-right button.
# Why it changed
The user confirmed these signals are useful for admin/dev workflows during development but should not compete with the primary operator workflow experience. This preserves the canonical Cerebro UI shell and avoids introducing a parallel product UI inside the main screen.
# Impact (UI / logic / data)
UI: Main tri-pane surfaces stay focused on operator tasks; internal validation remains accessible. Logic/Data: Reuses existing P0 backend wiring and client-side polling; no integration capability changes. Launch policy constraints remain explicit in human language inside the dev pane (Autotask two-way, others read-only).
# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md
# Date
2026-02-26
