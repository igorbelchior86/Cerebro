# IT Glue Runbooks 404 Resilience
# What changed
- Updated `PrepareContextService` IT Glue phase to handle `404` from runbooks/documents endpoint as a scoped capability issue instead of total IT Glue failure.
- When runbooks endpoint is unavailable:
  - keep IT Glue phase running,
  - continue with org/config/contact context,
  - record provenance in `source_findings` (`runbooks endpoint: unavailable (404)`).
- Added domain-based fallback matching in IT Glue org resolution using email domains extracted from ticket text.

# Why it changed
- IT Glue credentials were valid (`/organizations` returned 200), but `/documents` returned 404 for this tenant/API capability.
- Previous behavior treated this as full IT Glue failure, injecting noisy `missing_data` and degrading downstream diagnosis/playbook quality.

# Impact (UI / logic / data)
- UI: timeline/source findings now reflect partial IT Glue capability instead of blanket failure.
- Logic: IT Glue failures are now granular; runbooks unavailability no longer aborts context collection.
- Data: `missing_data` no longer includes IT Glue false-negative for this scenario; detailed provenance remains in `source_findings`.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts

# Date
- 2026-02-20
