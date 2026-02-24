# UI Bento Shell and Professional Palette Refresh
# What changed
- Refactored the triage UI shell to a bento-style layout with separated rounded panels, thin outlines, and panel gutters in the resizable 3-column layout.
- Applied a deeper, lower-contrast palette with subtler accent usage and refined shadows/borders through global design tokens.
- Switched the base UI font to Geist Sans (with existing fallbacks preserved).
- Updated center-column surfaces (home + ticket detail), sidebar shell sections, playbook panel topbar, and chat input to match the new modular visual language.
- Added small bento summary tiles to `triage/home` to reinforce the new grid hierarchy.

# Why it changed
- The previous UI shell used continuous column surfaces and stronger contrast, which reduced visual hierarchy and made the interface feel heavier.
- The requested direction was a professional bento design with deep tones, ultrathin borders, modern sans-serif typography, and minimal visual noise.

# Impact (UI / logic / data)
- UI: Significant visual refresh of the triage/chat shell and panel hierarchy (bento layout style).
- Logic: No behavior changes to triage, chat, playbook, or ticket selection flows.
- Data: No changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/styles/globals.css
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/layout.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ResizableLayout.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatSidebar.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/PlaybookPanel.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatInput.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/home/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx

# Date
- 2026-02-24
