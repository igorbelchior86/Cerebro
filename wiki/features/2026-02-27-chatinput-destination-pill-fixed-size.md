# Title
ChatInput Destination Pill Fixed Size

# What changed
Adjusted the destination pill inside the chat input to keep a fixed size regardless of current state.

Current behavior:
- Pill keeps a single fixed dimension in both states.
- Only label text and color change when toggling (`AI` ↔ `User`).
- Toggle logic and submit contract (`targetChannel`) remain unchanged.

# Why it changed
The user requested a stable visual footprint for the destination control to reduce micro-layout shifts and keep the composer cleaner.

# Impact (UI / logic / data)
- UI:
  - Destination pill now has fixed width/height and centered text.
  - No size variation between `AI` and `User` states.
- Logic:
  - No behavior changes in channel switching.
- Data:
  - No schema/API changes.

# Files touched
- apps/web/src/components/ChatInput.tsx
- wiki/features/2026-02-27-chatinput-destination-pill-fixed-size.md

# Date
2026-02-27
