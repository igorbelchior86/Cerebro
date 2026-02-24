# Title
Format email signatures in `Clean` ticket text

# What changed
- Added signature-aware formatting to `PrepareContext` canonical text post-processing (`text_clean`).
- `Clean` text now preserves readable line breaks for detected signature/contact blocks instead of flattening all whitespace.
- Added regression test for a flattened email signature example.

# Why it changed
The `Clean` ticket text became the primary view, so flattened signatures/contact info were too hard to read in the timeline UI.

# Impact (UI / logic / data)
- UI: cleaner, readable signature blocks in the `Clean` text view.
- Logic: deterministic post-processing now formats likely signature blocks.
- Data: `ticket_text_artifact.text_clean` may now include line breaks in signature sections.

# Files touched
- `apps/api/src/services/prepare-context.ts`
- `apps/api/src/__tests__/services/prepare-context.test.ts`

# Date
2026-02-24
