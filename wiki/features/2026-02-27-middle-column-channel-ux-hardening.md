# Title
Middle Column Channel UX Hardening (AI vs PSA/User)

# What changed
Refined the visual hierarchy of the middle-column channel experience introduced in the previous iteration.

Main UI hardening changes:
- Removed floating channel badge overlays from inside assistant bubbles.
- Moved channel identity to the message metadata row to reduce text-content interference.
- Upgraded external delivery feedback (`sending/sent/failed/retrying`) to semantic status chips with clearer error presentation and retry affordance.
- Refined composer destination row (`AI` / `PSA/User`) with stronger hierarchy and cleaner segmented control styling.
- Reduced hint visual aggressiveness when destination toggle is active (pills instead of raised tabs in this mode).
- Converted channel filter into a connected segmented group with per-channel counts.
- Added subtle lateral accent for external-channel bubbles to improve channel distinction without heavy background fill.

# Why it changed
User feedback indicated the previous UI was visually noisy and hard to scan.

This hardening pass focused on readability and operator clarity:
- content remains dominant;
- channel/delivery metadata is visible but not intrusive;
- controls are grouped with consistent visual hierarchy.

# Impact (UI / logic / data)
- UI:
  - cleaner bubble presentation and metadata placement;
  - clearer delivery status semantics for external communication;
  - improved filter and composer control readability.
- Logic:
  - no behavior/flow contract changes;
  - existing channel and delivery mechanics preserved.
- Data:
  - no schema or API contract changes.

# Files touched
- apps/web/src/components/ChatMessage.tsx
- apps/web/src/components/ChatInput.tsx
- apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- tasks/todo.md
- tasks/lessons.md
- wiki/features/2026-02-27-middle-column-channel-ux-hardening.md

# Date
2026-02-27
