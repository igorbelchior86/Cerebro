# Title
UI Modern Theme Refresh (No Blue, Sage/Slate Palette)

# What changed
- Replaced global accent tokens in `apps/web/src/styles/globals.css` from blue to a sage/slate accent (`--accent: #6F8F7E`) and updated derived tokens (`--accent-muted`, `--border-accent`, `--accent-glow`, legacy aliases).
- Neutralized light theme surfaces to reduce blue cast and improve visual sophistication (`--bg-root`, `--bg-sidebar`, `--bg-panel`, `--bg-chat`, text neutrals).
- Removed visible blue hardcodes from triage/chat/sidebar/playbook/profile/settings surfaces, replacing them with theme variables.

# Why it changed
- The current interface had an undesired blue-heavy aesthetic.
- Goal was a cleaner, modern, less saturated visual direction while preserving hierarchy, readability, and current UX behavior.

# Impact (UI / logic / data)
- UI: High visual impact in triage/chat/sidebar/playbook and profile/settings details.
- Logic: No behavioral changes.
- Data/API: No schema, contract, or integration changes.

# Files touched
- `apps/web/src/styles/globals.css`
- `apps/web/src/features/chat/sidebar/SidebarControls.tsx`
- `apps/web/src/features/chat/sidebar/utils.ts`
- `apps/web/src/features/chat/sidebar/SidebarTicketCard.tsx`
- `apps/web/src/features/chat/playbook/PlaybookHypotheses.tsx`
- `apps/web/src/features/chat/playbook/PlaybookChecklist.tsx`
- `apps/web/src/features/chat/playbook/primitives.tsx`
- `apps/web/src/components/ProfileModal.tsx`
- `apps/web/src/components/ChatInput.tsx`
- `apps/web/src/components/ChatMessage.tsx`
- `apps/web/src/components/UserProfileDropdown.tsx`
- `apps/web/src/components/SettingsModal.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`

# Date
2026-03-04
