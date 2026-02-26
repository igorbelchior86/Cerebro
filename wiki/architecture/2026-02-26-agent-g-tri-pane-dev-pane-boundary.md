# Agent G Tri-Pane Canonical UX vs Dev Pane Boundary (P0)
# What changed
Defined an explicit frontend boundary in the tri-pane ticket screen: canonical operator UI remains in the left/center/right panes, while P0 validation and admin/dev instrumentation is rendered in a toggleable floating pane (`triage/[id]`) anchored to the bottom-right corner.
# Why it changed
The previous in-line P0 instrumentation introduced a parallel visual hierarchy inside the canonical tri-pane workflow. Separating developer/validation instrumentation into a contextual overlay preserves the product UX while retaining operational visibility for development and QA.
# Impact (UI / logic / data)
UI: Canonical panes are less cluttered; dev/admin signals are discoverable but non-intrusive. Logic: Existing polling/view-model logic remains in the same page and feeds both canonical UI and floating pane. Data: No new endpoints and no response-shape changes.
# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md
# Date
2026-02-26
