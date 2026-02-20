# Changelog: IT Glue Runbooks 404 Resilience
# What changed
- Hardened `PrepareContext` IT Glue collection path to tolerate runbooks/documents endpoint `404` without failing the whole IT Glue stage.
- Added org resolution fallback by email domain extracted from ticket content.
- Reprocessed tickets `T20260220.0012`, `T20260220.0013`, `T20260220.0014` after patch.

# Why it changed
- IT Glue API key was valid for organizations/config endpoints, but runbooks endpoint returned 404 in this environment.
- Full-failure behavior was producing misleading `missing_data` and reducing context quality.

# Impact (UI / logic / data)
- UI: source findings now state runbooks endpoint unavailability explicitly.
- Logic: partial IT Glue availability is handled gracefully.
- Data: for the reprocessed tickets, `missing_data` no longer reports IT Glue retrieval failure.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts

# Date
- 2026-02-20
