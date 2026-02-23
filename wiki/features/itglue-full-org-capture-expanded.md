# IT Glue Full Org Capture Expanded
# What changed
- Expanded IT Glue org capture to include `organization_details`, `locations`, `domains`, and `ssl_certificates` in addition to configs/passwords/assets/docs/contacts.
- Kept the recursive pipeline order with IT Glue pass before and after history.
- LLM extraction input now receives the expanded IT Glue corpus summary.

# Why it changed
- Requirement was to capture all available IT Glue org context for stronger refinement and higher field coverage.
- Subset-only collection was insufficient for many client environments.

# Impact (UI / logic / data)
- UI: Indirect improvement via richer refined outputs reaching SSOT.
- Logic: IT Glue stage now captures broader org-level resources on each pipeline run.
- Data: `itglue_org_snapshot.payload` now includes additional resource groups.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/clients/itglue.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts

# Date
- 2026-02-23
