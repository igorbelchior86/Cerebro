# Title
ChatInput Dynamic Textarea (Auto-grow up to 5 lines)

# What changed
Replaced the single-line text input in ChatInput with a dynamic textarea that grows while typing up to a maximum of 5 visible lines.

# Why it changed
The composition area needed multiline behavior with progressive growth to support longer operator messages without losing compact layout constraints.

# Impact (UI / logic / data)
- UI: Input now expands in height while typing and caps at 5 lines.
- Logic: Keyboard behavior updated to `Enter` submit and `Shift+Enter` newline.
- Data: No API or persistence contract change.

# Files touched
- apps/web/src/components/ChatInput.tsx
- tasks/todo.md
- wiki/features/2026-02-27-chatinput-dynamic-textarea-5-lines.md

# Date
2026-02-27
