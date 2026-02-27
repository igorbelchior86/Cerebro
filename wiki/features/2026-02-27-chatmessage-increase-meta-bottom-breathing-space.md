# Title
ChatMessage Increased Breathing Space Below Metadata Row

# What changed
Increased the vertical spacing after each message metadata row (channel + timestamp + stage label) to improve readability in dense timelines.

Applied spacing adjustments:
- Message block bottom spacing increased from `10px` to `16px`.
- Metadata top margin increased from `6px` to `8px`.

This applies to both assistant/pipeline messages and user messages in the central feed.

# Why it changed
With high message volume, metadata lines were visually too close to the next bubble, making scanning harder. The added spacing creates clearer separation between consecutive messages.

# Impact (UI / logic / data)
- UI:
  - Improved readability and rhythm between chat blocks.
- Logic:
  - No behavior changes.
- Data:
  - No schema/API changes.

# Files touched
- apps/web/src/components/ChatMessage.tsx
- wiki/features/2026-02-27-chatmessage-increase-meta-bottom-breathing-space.md

# Date
2026-02-27

## Incremental update (same day)
- Increased spacing one more step after user feedback:
  - message block bottom spacing: `16px` -> `20px`
  - metadata top spacing: `8px` -> `10px`
