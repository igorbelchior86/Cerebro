# Polling Jitter Fix (Side/Center Stability)
# What changed
- Added timeline signature guard to avoid re-rendering/replacing timeline messages on every polling tick.
- Replaced volatile per-tick timestamps with deterministic timeline timestamps derived from ticket creation time.
- Removed automatic smooth scroll-to-bottom behavior on each message update.
- Decoupled timeline polling effect from sidebar list polling using a ref for current sidebar tickets.

# Why it changed
- UI still appeared to "lift/fall" when switching tickets due to periodic timeline resets, timestamp churn, and auto-scroll effects.

# Impact (UI / logic / data)
- UI: Significantly more stable center/side behavior during ticket switches and polling.
- Logic: Timeline updates are now driven by semantic change detection, not every poll interval.
- Data: No backend data/schema changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx

# Date
- 2026-02-20
