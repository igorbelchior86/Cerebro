# Title
ChatInput Dynamic Placeholder by Destination Pill Channel

# What changed
Updated the chat input placeholder text to change dynamically based on the currently selected destination pill state.

Current behavior:
- Pill = `AI` (`internal_ai`) -> placeholder: `Refine analysis with AI...`
- Pill = `User` (`external_psa_user`) -> placeholder: `Send update to user via PSA...`
- Disabled/loading state still uses the existing processing placeholder.

# Why it changed
The user requested clearer context in the composer so the placeholder reflects the active destination channel selected in the pill.

# Impact (UI / logic / data)
- UI:
  - Placeholder now communicates channel intent before typing.
- Logic:
  - No payload/command behavior changes; only display text changes.
- Data:
  - No schema/API changes.

# Files touched
- apps/web/src/components/ChatInput.tsx
- wiki/features/2026-02-27-chatinput-dynamic-placeholder-by-pill-channel.md

# Date
2026-02-27
