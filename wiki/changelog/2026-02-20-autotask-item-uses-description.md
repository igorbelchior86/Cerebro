# Autotask Timeline Item Uses Ticket Description
# What changed
- Updated ticket list API mapping to return `description` to the web client.
- Updated timeline item 1 (Autotask) to use ticket `description` as the problem text.
- Kept fallback to ticket `title` when description is empty, preserving compatibility.

# Why it changed
- Timeline item 1 must describe the problem using ticket description, not the title.

# Impact (UI / logic / data)
- UI: First timeline message now reflects actual issue description text.
- Logic: Description-first composition with title fallback.
- Data: API response now includes `description` field for each ticket.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/email-ingestion.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatSidebar.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx

# Date
- 2026-02-20
