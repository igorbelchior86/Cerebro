# Ticket Field Quality SSOT Stabilization
# What changed
- Added deterministic field-quality merge for sidebar ticket data in triage page polling.
- Merge now chooses best candidate per field (`title`, `description`, `company`, `requester`, `org`, `site`) instead of accepting latest meaningful string blindly.
- Added tie-break rule for title to prefer cleaned/shorter variant when quality scores tie.

# Why it changed
- Even after race guards, ticket fields still toggled between raw noisy and normalized variants across polls.
- The root cause was merge policy based on non-empty checks only, without quality ranking.

# Impact (UI / logic / data)
- UI: Sidebar and center section keep stable normalized identity content over time.
- Logic: Frontend SSOT merge is monotonic by quality for key ticket identity fields.
- Data: No database/schema changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx

# Date
- 2026-02-20
