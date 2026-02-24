# IT Glue Round 2 Quota Guardrails
# What changed
- Added explicit IT Glue request guardrails in round 2 of `PrepareContext` (`/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`):
  - `ITGLUE_ROUND2_REQUEST_BUDGET` (hard request cap per ticket round)
  - `ITGLUE_MAX_SCOPE_ORGS` (cap on parent/child family scope fan-out)
  - `ITGLUE_MAX_FLEXIBLE_ASSET_TYPES_PER_SCOPE` (cap on `flexible_asset_types` fan-out)
  - `ITGLUE_MAX_DOCUMENT_EXPANSIONS` (cap on attachment/related-item expansion)
- Added budget-aware request wrapper for IT Glue round-2 calls:
  - decrements budget before request
  - surfaces budget exhaustion as `collection_errors`
  - captures `429` messages as rate-limit-specific collection errors
- Added generic ranking/selection helper for flexible asset types (`selectITGlueFlexibleAssetTypesForTicket`) so the collector prioritizes high-signal types (internet/WAN/network/firewall/WiFi/switch/etc.) instead of querying every type.
- Round-2 `source_findings` now logs:
  - budget used/remaining
  - selected flexible asset type count per scope vs total available

# Why it changed
- After enabling parent+child IT Glue family collection, the round-2 collector could explode request volume through a cartesian product:
  - `scope_orgs × flexible_asset_types`
  - plus document attachment/related-item expansion
- This caused API quota exhaustion (`429` / quota exceeded) when testing multiple tickets.
- The pipeline needed explicit volume guardrails, not just functional extraction logic.

# Impact (UI / logic / data)
- UI: No direct UI changes.
- Logic:
  - Round-2 IT Glue collection is now budgeted and bounded.
  - The collector may intentionally skip lower-priority IT Glue calls when the budget is exhausted.
- Data:
  - Coverage is more stable under quota pressure (high-value IT Glue data prioritized first).
  - `source_findings`/`collection_errors` are more informative for quota troubleshooting.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-02-24
