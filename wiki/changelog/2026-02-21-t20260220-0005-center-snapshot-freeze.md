# T20260220.0005 Center Snapshot Freeze
# What changed
- Implemented a per-ticket stable snapshot in triage detail page polling flow.
- Timeline message source fields (`title/description/requester/org/site`) now preserve previously meaningful values and refuse downgrade to placeholders (`Untitled/Unknown`) on later polls.
- Snapshot also stabilizes initial timeline timestamps for a ticket using a persisted `createdAt` source.

# Why it changed
- The same ticket (`T20260220.0005`) was alternating between rich text and placeholder text in the center panel within seconds, even while staying on the same ticket.

# Impact (UI / logic / data)
- UI: center timeline remains semantically stable across polls for the same ticket.
- Logic: polling became monotonic for displayed ticket metadata (upgrade allowed, downgrade blocked).
- Data: no database/schema changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/features/pipeline-only-ticket-flow-stabilization.md

# Date
- 2026-02-21
