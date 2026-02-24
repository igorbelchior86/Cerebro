# IT Glue Org Resolution Ranking + Page Size Hardening

# What changed
- Hardened IT Glue org resolution in `PrepareContext` to avoid false-positive matches across similar company names.
- Switched org selection from first boolean fuzzy match (`find`) to ranked scoring (`scoreOrgNameMatch`) using normalized name + short name.
- Increased IT Glue organizations fetch for matching from default page size to `1000` (`getOrganizations(1000)`).
- Added generic-token penalty (e.g. `resources`, `solutions`, `services`) so matches do not pass on shared generic words only.
- Hardened IT Glue domain fallback by filtering service/boilerplate domains (`outlook`, `autotask`, `itclientportal`, `refreshtech`) before `primary_domain` matching.
- Applied the same ranked org matching approach to NinjaOne org resolution (name-based).
- Fixed broad history company filter runtime error by replacing nonexistent `tickets_processed.company` filter with `ticket_ssot.payload->>'company'` join/filter.

# Why it changed
- Troubleshooting `T20260223.0006` showed the pipeline resolving `CAT Resources, LLC` to `Composite Resources, Inc.` in IT Glue.
- This wrong org selection caused `passwords/docs/assets` retrieval to return zero, which made downstream SSOT network/infra fields remain `unknown`.
- The root causes were: partial org inventory (`page[size]=100`) and permissive/first-match resolution behavior.
- Validation also exposed a separate runtime issue in round 8 history search (`42703` on `tickets_processed.company`), which prevented reliable refresh verification.

# Impact (UI / logic / data)
- Logic: org resolution is now more selective and deterministic in multi-tenant environments with similar company names.
- Logic: broad history scope-by-company now uses the actual persisted SSOT source instead of a nonexistent `tickets_processed` column.
- Data: IT Glue snapshots/enrichment should attach to the correct org more often, enabling WAN/password/doc extractors to populate SSOT candidates.
- UI: no direct UI change, but center/right panels should show fewer `unknown` values once correct IT Glue org snapshots are captured.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-02-23
