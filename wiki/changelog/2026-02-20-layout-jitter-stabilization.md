# Layout Jitter Stabilization (Side + Center)
# What changed
- Right panel in triage detail is now always mounted (instead of conditional mount when playbook becomes ready).
- Middle header title is constrained to single-line ellipsis to avoid variable header height.
- Playbook-ready badge now reserves layout space via `visibility` toggling instead of mount/unmount.

# Why it changed
- Ticket switching was causing visible UI "lift/fall" due to layout reflow from conditional panel rendering and variable header geometry.

# Impact (UI / logic / data)
- UI: More stable side/center interaction and less visual jump during ticket switches.
- Logic: No business logic changes.
- Data: No backend changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx

# Date
- 2026-02-20
