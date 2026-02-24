# 2026-02-24 Clean Ticket Text Simple Email Body Formatting
# What changed
- Replaced the richer heuristic `Clean` UI (roster/table/badges) with a simple email-body formatter.
- `Clean` now renders as readable paragraphs/lists/signature lines using deterministic text normalization only.
- `Original` mode remains unchanged.
- Removed the displayed prefix label (`Cleaned ticket text ...`) from the `Clean` content body.
- Added simple roster block detection so onboarding-style name rows can render as a markdown table (or bullet list fallback for short runs).
- Improved detection robustness with line classification + roster-block scoring (instead of pure per-line regex checks).
- Fixed markdown table rendering by emitting table rows as one contiguous markdown block.

# Why it changed
- UX feedback indicated the richer formatting was confusing and visually poor. A simpler email-style presentation is more reliable and easier to scan.
- Additional feedback requested removal of the verbose prefix and better list/table handling for roster-like lines.

# Impact (UI / logic / data)
- UI: Cleaner `Clean` view with reduced visual noise.
- Logic: Frontend-only formatting helper in `ChatMessage`.
- Data: No schema/API/payload changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatMessage.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md

# Date
- 2026-02-24
