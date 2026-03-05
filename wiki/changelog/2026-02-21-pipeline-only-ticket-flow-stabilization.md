# Pipeline-only Ticket Flow Stabilization
# What changed
- Reworked `/ticket-intake/list` to emit tickets from latest pipeline session per ticket, instead of blending session, processed, and raw fallback sources.
- Removed raw fallback hydration from `tickets_raw` in list responses.
- Updated evidence join to read the most recent evidence pack of the ticket (across ticket sessions) to avoid field regression on session retries.
- Removed triage-page synthetic fallback card insertion and local quality-based merge logic.
- Lowered sidebar clock update cadence from 1s to 30s.

# Why it changed
- Sidebar/center bars were intermittently switching fields, counters, and ticket visibility due multiple competing state sources and fallback rehydration.
- Product decision: strict `pipeline ou nada`.

# Impact (UI / logic / data)
- UI: no temporary card reappearance/disappearance from local fallback behavior.
- Logic: deterministic pipeline-first list assembly and rendering.
- Data: unchanged schema; endpoint response composition updated.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/ticket-intake.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatSidebar.tsx

# Date
- 2026-02-21
