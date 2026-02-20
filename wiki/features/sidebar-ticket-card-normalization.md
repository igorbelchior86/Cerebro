# Sidebar Ticket Card Normalization and 5-Line Layout
# What changed
- Updated sidebar ticket card rendering to extract and display normalized fields in a fixed 5-line format.
- Added text normalization utilities to clean HTML tags/entities and collapse whitespace before rendering.
- Added explicit ticket card logical mapping for: `priority`, `id`, `status`, `title`, `company`, `requester`, `createdAt`.
- Updated API mapping in email ingestion list endpoint to return explicit `company` and `requester` fields.

# Why it changed
- Sidebar cards needed deterministic, clean, and consistent extraction of ticket information from noisy input.
- Titles containing HTML or malformed spacing caused poor readability and inconsistent UI.
- `company/requester` context was previously ambiguous in mapped fields and needed clear semantics for card display.

# Impact (UI / logic / data)
- UI: Card now shows structured 5-line content with normalized text and a visual status badge.
- Logic: Added frontend normalization and standardized status labels (`DONE`, `ACTIVE`, `PENDING`, `FAILED`).
- Data: API `/email-ingestion/list` now includes explicit `company` and `requester` output fields for sidebar consumption.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatSidebar.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/email-ingestion.ts

# Date
- 2026-02-20
