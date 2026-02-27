# Title
Send Button with Visible Keyboard Shortcut

# What changed
Updated ChatInput send button to display a visible keyboard shortcut indicator (`↵`) next to the send icon and added explicit `Send (Enter)` tooltip/aria label.

# Why it changed
The user requested clear discoverability of the keyboard shortcut directly on the send control.

# Impact (UI / logic / data)
- UI: Send button now shows the shortcut marker visually.
- Logic: Existing behavior preserved (`Enter` submit, `Shift+Enter` newline).
- Data: No API or persistence changes.

# Files touched
- apps/web/src/components/ChatInput.tsx
- tasks/todo.md
- wiki/features/2026-02-27-send-button-visible-shortcut.md

# Date
2026-02-27
