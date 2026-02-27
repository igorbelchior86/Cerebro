# Title
ChatInput Destination Toggle as Single Pill Inside Text Field

# What changed
Changed the destination selector UI from a separate segmented block to a single inline pill button inside the text input container (left side).

Behavior now:
- Default label is `AI` (maps to `internal_ai`).
- Clicking the pill toggles destination to `User` (maps to `external_psa_user`).
- Clicking again toggles back to `AI`.
- Existing submit payload contract remains unchanged (`targetChannel`).

# Why it changed
The previous destination control was visually heavier than desired and did not match the requested interaction model. The user requested a compact single-pill toggle directly inside the text field for faster channel switching and cleaner layout.

# Impact (UI / logic / data)
- UI:
  - Destination control is now inline in the composer, left of the textarea.
  - Reduced visual weight by removing the dedicated top destination block.
- Logic:
  - No routing/command behavior changes.
  - Channel toggle still drives `targetChannel` in submit payload.
- Data:
  - No schema/API changes.

# Files touched
- apps/web/src/components/ChatInput.tsx
- tasks/todo.md
- tasks/lessons.md
- wiki/features/2026-02-27-chatinput-destination-single-pill-inside-field.md

# Date
2026-02-27
