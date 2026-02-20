# Task: Ensure card title uses ticket Title (not Description)
**Status**: completed
**Started**: 2026-02-20

## Plan
- [x] Step 1: Reproduce wrong title extraction path.
- [x] Step 2: Fix backend parser to capture `Title` field with proper delimiters.
- [x] Step 3: Add frontend defensive normalization to strip accidental `Description:` suffix.
- [x] Step 4: Verify with typecheck.
- [x] Step 5: Update wiki + lessons.

## Open Questions
- None.

## Progress Notes
- Updated parser regex with lookahead so `Title` stops before `Description` / other field markers.
- Updated fallback subject cleanup to remove ticket-prefix noise.
- Added UI defensive sanitizer for unexpected residual `Description:` in title payload.

## Review
- What worked:
  - Backend parser fix addresses root cause at data source.
  - Frontend sanitizer provides safety for already-ingested noisy records.
- What was tricky:
  - Email templates vary in line breaks/HTML, requiring field-boundary extraction rather than line-only extraction.
- Time taken:
  - ~15 minutes
