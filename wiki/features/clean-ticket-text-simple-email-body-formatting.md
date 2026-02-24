# Clean Ticket Text Simple Email Body Formatting
# What changed
- Simplified the `Clean` ticket text rendering to a predictable email-body style presentation.
- Removed the structured heuristic UI layers (roster cards / roster table disclosure / helper badge) from the `Clean` display path.
- Kept a deterministic formatting pass focused on:
  - paragraph breaks
  - numbered list separation (`1.`, `2.`, ...)
  - callout separation (`NOTE`, `GOAL`)
  - signature/contact line breaks (`Thanks`, `Direct:`, `Phone:`, `Email:`)
- Removed the verbose prefix line (`Cleaned ticket text (noise removed, meaning preserved):`) from the displayed `Clean` content.
- Added simple roster/list detection in the formatter:
  - 3+ consecutive likely roster lines are rendered as a markdown table (`Name | Details`)
  - shorter runs fall back to bullet list formatting
- Upgraded the formatter from line regex-only logic to a lightweight line-classification + roster-block scoring approach (safer fallback behavior).
- Fixed markdown table emission to preserve contiguous table rows as a single markdown block (so the table actually renders).
- Added a secondary segmentation pass to split glued roster entries inside a single line using person-name + employment boundaries (common in normalized onboarding text).
- Refined the secondary segmentation pass to avoid false splits on role phrases (e.g. `Business Development`, `Williams Marketing`) by using a conservative match-based splitter with stopwords.
- Added a fragment merge pass for orphan name lines (e.g. `Brittany`) followed by roster details on the next line.
- Added explicit markdown table styling in `MarkdownRenderer` so rendered roster tables look visibly like tables (headers, borders, row separation).

# Why it changed
- Prior richer formatting attempts overemphasized heuristic parsing and made the UI confusing / visually noisy.
- The user explicitly requested a simple email body formatting approach.

# Impact (UI / logic / data)
- UI: `Clean` text is now calmer and easier to read, without inferred structured views.
- Logic: Frontend-only formatting helper in `ChatMessage`; no parsing-driven visual extraction shown to the user.
- Data: No backend/pipeline/LLM changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatMessage.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/MarkdownRenderer.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md

# Date
- 2026-02-24
