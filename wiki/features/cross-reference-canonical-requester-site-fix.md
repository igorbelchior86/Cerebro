# Cross-reference Canonical Requester/Site Fix
# What changed
- Fixed ticket list mapping to stop reusing requester as site in `/email-ingestion/list`.
- Added canonical requester precedence from iterative enrichment (`affected_user_name` / `requester_name`) when building sidebar ticket payload.
- Added explicit site extraction fallback from raw ticket body, independent from requester.
- Updated triage page bindings to prioritize canonical requester/company from `full-flow.ticket` before sidebar fallback fields.

# Why it changed
- Cross-reference UI was showing wrong identity fields in sidebar and right panel even when LLM normalization had already identified the correct user.

# Impact (UI / logic / data)
- UI: requester and site now render from the correct source precedence, reducing false identity/site labels.
- Logic: stronger canonical field precedence and safer fallback chain.
- Data: no schema changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/email-ingestion.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx

# Date
- 2026-02-21
