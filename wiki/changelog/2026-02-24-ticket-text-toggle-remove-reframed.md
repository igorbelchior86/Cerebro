# Title
Remove `Reframed` option from ticket text toggle

# What changed
- UI toggle in chat/timeline Autotask message now renders only `Clean` and `Original`.
- Initial mode defaults to `Clean` (when available) and falls back to `Original`.

# Why it changed
To simplify the ticket text view and remove the `Reframed` option from the user-facing toggle.

# Impact (UI / logic / data)
- UI: two-state toggle instead of three-state toggle.
- Logic: safer fallback to visible modes only.
- Data: none.

# Files touched
- `apps/web/src/components/ChatMessage.tsx`

# Date
2026-02-24
