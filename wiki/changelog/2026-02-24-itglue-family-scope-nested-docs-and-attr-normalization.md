# IT Glue Family Scope + Nested Docs/Passwords + Attr Normalization
# What changed
- Hardened IT Glue round-2 collection in `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts` to collect across a small **organization family scope** instead of a single org only:
  - matched org
  - parent / ancestors
  - relevant descendants (ranked by company-name score)
- Added generic row aggregation helper (`mergeRowsById`) so configs/contacts/passwords/assets/docs from multiple IT Glue org scopes can be merged without duplicate IDs.
- Added generic IT Glue attribute reader (`itgAttr`) that resolves `kebab-case`, `snake_case`, camelCase, and flexible-asset `traits` values.
- Updated IT Glue extraction paths (snapshot summarization + contact/config/password parsing) to use `itgAttr`, improving visibility of API attributes returned in `kebab-case`.
- Updated `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/clients/itglue.ts`:
  - `getOrganizationDocuments` and `getOrganizationDocumentsRaw` now try nested `/organizations/:id/relationships/documents` first and fallback to global `/documents` only on `404`
  - `getPasswords` now tries nested `/organizations/:id/relationships/passwords` first and falls back to global `/passwords` only on `404`
- Round-2 source findings and raw snapshot now include `scope_orgs`, making parent/child collection visible in diagnostics.

# Why it changed
- Troubleshooting `T20260223.0006` proved the pipeline identified the company and a valid IT Glue org context, but extraction still failed because:
  - relevant data was split between **parent** and **child** orgs in IT Glue (Composite/CAT)
  - the tenant returns `404` for global `/documents?filter[organization_id]=...` while nested documents works
  - many IT Glue attributes arrive in `kebab-case`, but several extractors were reading `snake_case` only
- This caused `passwords/docs/assets` to appear empty or unusable, leaving SSOT fields (`isp_name`, `wifi_make_model`, `firewall_make_model`) as `unknown`.

# Impact (UI / logic / data)
- UI: No direct UI code changes, but center/right panels should receive richer SSOT values after refresh when IT Glue family scopes contain WAN/password/document clues.
- Logic: Prepare Context no longer assumes a single IT Glue org is sufficient; it collects a bounded family scope and keeps error observability (`collection_errors`) instead of silently missing data.
- Data:
  - IT Glue snapshots now carry `scope_orgs`
  - `documents_raw` should populate via nested endpoint in tenants where global `/documents` returns `404`
  - attribute extraction from IT Glue records is more resilient across API naming variants

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/clients/itglue.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`

# Date
- 2026-02-24
