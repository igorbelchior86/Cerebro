# Sidebar Home History Auth Fetch
# What changed
- Updated home route sidebar fetch (`/ticket-intake/list`) to include session credentials.
- Added failure visibility via status logging.

# Why it changed
- History was restored in API, but home route still fetched without auth cookies, resulting in empty view.

# Impact (UI / logic / data)
- UI: Home sidebar displays historical tickets again for authenticated users.
- Logic: Consistent authenticated fetch contract across chat/triage screens.
- Data: No data model impact.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/home/page.tsx

# Date
- 2026-02-20
