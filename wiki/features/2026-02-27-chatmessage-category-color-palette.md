# Title
ChatMessage Category-Based Bubble Colors (Palette Harmonized)

# What changed
Implemented category-driven bubble background/border/accent colors in `ChatMessage` using a harmonized variation set from the app palette.

Implemented categories:
- `ai`: generic assistant/AI pipeline messages
- `note`: Autotask note/intake-style message (`type=autotask`)
- `tech_to_ai`: technician message in AI channel (`role=user`, `channel=internal_ai`)
- `tech_to_user`: technician message in external PSA/User channel (`role=user`, `channel=external_psa_user`)
- `ai_exchange`: AI-side exchange text (`type=text`, `channel=internal_ai`)
- `ai_validation`: validation stage message (`type=validation`)
- `system_status`: system/status messages (`role=system` or `type=status`)

Styling model:
- Category resolver: `resolveBubbleCategory(message)`
- Tone map: `BUBBLE_TONES`
- Applied to bubble background, border, accent inset, and channel badge surface.

# Why it changed
The user requested clearer visual separation for high-volume message feeds using color-coded categories while keeping harmony with the existing app palette.

# Impact (UI / logic / data)
- UI:
  - Faster message scanning by category due to consistent color semantics.
  - Harmonized tones aligned with existing token colors (blue/green/amber/coral variants).
- Logic:
  - No workflow/API behavior changes.
  - Category computed deterministically from `role + channel + type`.
- Data:
  - No schema/API changes.

# Files touched
- apps/web/src/components/ChatMessage.tsx
- tasks/todo.md
- tasks/lessons.md
- wiki/features/2026-02-27-chatmessage-category-color-palette.md

# Date
2026-02-27
