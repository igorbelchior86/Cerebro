# Changelog: Sidebar Home Credentials Fix
# What changed
- Added `credentials: 'include'` to ticket list fetch in triage home page.
- Added explicit non-200 logging for list fetch failures.

# Why it changed
- Sidebar on home screen could show empty state because authenticated cookies were not sent.

# Impact (UI / logic / data)
- UI: Ticket history now loads in home sidebar when user session is authenticated.
- Logic: Home page fetch behavior now matches other authenticated API calls.
- Data: No schema changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/home/page.tsx

# Date
- 2026-02-20
