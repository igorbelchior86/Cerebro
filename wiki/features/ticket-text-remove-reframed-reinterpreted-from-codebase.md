# Title
Remove `reframed/reinterpreted` from the ticket-text code path (API + web)

# What changed
- Removed `reinterpreted` from the web chat message ticket-text variant model (`ChatMessage`).
- Removed web timeline construction/consumption of:
  - `ticket_text_artifact.text_reinterpreted`
  - `ticket_text_artifact.title_reinterpreted`
- Timeline primary text now uses `text_clean` when available, otherwise falls back to original/problem description.
- Removed persistence of `title_reinterpreted` and `text_reinterpreted` from the current API `ticket_text_artifact` payload generation in `PrepareContext`.

# Why it changed
The requested scope was to remove the `Reframed`/`reinterpreted` concept entirely from the active codebase flow, not only hide the UI toggle option.

# Impact (UI / logic / data)
- UI: ticket text toggle remains `Clean` / `Original` only.
- Logic: active code paths no longer depend on a `reinterpreted` text variant.
- Data: historical rows may still contain `*_reinterpreted` fields in stored JSON payloads, but new code no longer writes or reads them.

# Files touched
- `apps/web/src/components/ChatMessage.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `apps/api/src/services/prepare-context.ts`

# Date
2026-02-24
