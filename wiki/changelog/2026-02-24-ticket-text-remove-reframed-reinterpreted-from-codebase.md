# Title
Remove `reframed/reinterpreted` from ticket-text code flow

# What changed
- Web message model and timeline builder no longer include `reinterpreted` ticket text variants.
- Web `/triage/[id]` timeline message now uses `text_clean` as the preferred normalized intake text.
- API `PrepareContext` no longer persists `title_reinterpreted` / `text_reinterpreted` in `ticket_text_artifact`.

# Why it changed
Follow-up scope clarification: `Reframed` should be removed from the codebase flow, not only from the UI toggle.

# Impact (UI / logic / data)
- UI: unchanged from prior patch (`Clean` / `Original` only).
- Logic: no active code references remain to `reframed/reinterpreted`.
- Data: old stored JSON payloads may still carry legacy fields, but they are ignored.

# Files touched
- `apps/web/src/components/ChatMessage.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `apps/api/src/services/prepare-context.ts`

# Date
2026-02-24
