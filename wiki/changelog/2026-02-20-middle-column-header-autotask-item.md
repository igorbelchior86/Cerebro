# Middle Column: Header + Autotask First Item Parity
# What changed
- Header title in middle column now renders `ticket number — subject/title`.
- Added `autotask` message type mapping in chat messages to render source label/icon correctly.
- First timeline message now includes full issue narrative with source context:
  ticket id, subject/title, requester, org/site, priority, and kickoff sentence.

# Why it changed
- The middle column still lacked key parity items from the provided mockup:
  - header did not include subject/title with ticket number,
  - first timeline item did not present source and full issue context.

# Impact (UI / logic / data)
- UI: Header and first timeline item now match the requested information density.
- Logic: Timeline generation now interpolates ticket context with safe fallbacks for older done tickets.
- Data: No backend contract changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatMessage.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx

# Date
- 2026-02-20
