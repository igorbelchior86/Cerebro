# Ticket Title Field Boundary Fix
# What changed
- Fixed email ticket parser so `Title` extraction stops at field markers like `Description:` and does not absorb description text.
- Improved subject fallback cleanup to remove ticket-id subject prefixes.
- Added frontend defensive title cleanup to strip accidental trailing `Description: ...` from card title rendering.

# Why it changed
- Sidebar cards were showing ticket description content as part of title for templates where `Title` and `Description` appear in the same text flow.
- The expected behavior is to show the ticket `Title` field only.

# Impact (UI / logic / data)
- UI: Card title now reflects the ticket title only.
- Logic: Parser now uses stronger field-boundary extraction with lookahead markers.
- Data: Newly ingested tickets store cleaner title values.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/email/email-parser.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatSidebar.tsx

# Date
- 2026-02-20
