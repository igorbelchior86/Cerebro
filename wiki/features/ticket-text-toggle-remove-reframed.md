# Title
Ticket text toggle: remove `Reframed`, keep `Clean` and `Original`

# What changed
- Updated the Autotask ticket text toggle in `ChatMessage` to remove the `Reframed` option from the UI.
- The toggle now shows only:
  - `Clean`
  - `Original`
- Adjusted initial/fallback mode selection to prefer `clean` when available, otherwise `original`.

# Why it changed
The requested UI simplification removes the intermediate `Reframed` mode and keeps only the two text views that should remain visible to the user.

# Impact (UI / logic / data)
- UI: toggle pill now has only two options (`Clean`, `Original`).
- Logic: display fallback no longer depends on a hidden `reinterpreted` mode.
- Data: none (payload still may contain `reinterpreted`, but it is no longer shown in this toggle).

# Files touched
- `apps/web/src/components/ChatMessage.tsx`

# Date
2026-02-24
