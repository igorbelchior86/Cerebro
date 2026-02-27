# Title
ChatInput PSA Toolbar (Step 1/3)

# What changed
Added a PSA-oriented toolbar to the chat input area where suggestions currently live, with controls in this order: attachment (placeholder), emoji, vertical divider, bold, italic, underline, bulleted list, numbered list, and inline image (placeholder).

# Why it changed
The operator workflow needs a richer text-authoring surface compatible with PSA usage patterns before subsequent UI changes (suggestion tab repositioning and dynamic multiline input).

# Impact (UI / logic / data)
- UI: Toolbar now appears in both triage home and triage ticket chat input, without moving suggestion chips yet.
- Logic: Basic inline formatting helpers were added for emoji, bold, italic, underline, and list prefixes.
- Data: No API, schema, queue, or persistence changes.

# Files touched
- apps/web/src/components/ChatInput.tsx
- tasks/todo.md
- wiki/features/2026-02-27-chatinput-psa-toolbar-step1.md

# Date
2026-02-27
