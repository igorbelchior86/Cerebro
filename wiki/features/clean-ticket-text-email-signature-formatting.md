# Title
Improve `Clean` ticket text formatting for email signatures

# What changed
- Updated `PrepareContext` canonical ticket text post-processing to detect likely email signature/contact blocks and format them as readable multi-line sections instead of flattening everything into one line.
- Added a signature-aware formatting pass that:
  - detects likely signature start (signoff markers or trailing contact-card patterns),
  - preserves a clean body paragraph,
  - inserts line breaks for contact labels (`Phone`, `Direct`, `Email`, `Website`), email addresses, websites, phone numbers, and address starts,
  - includes a rejoin pass for over-split label/value pairs (e.g. `Direct: 704-...`).
- Added regression test coverage for a flattened email-signature example.

# Why it changed
`Clean` is now the primary ticket text view. The final whitespace collapse in canonical post-processing was flattening email signatures and contact details into a single unreadable line, producing poor readability in the UI.

# Impact (UI / logic / data)
- UI: `Clean` text in the Autotask timeline becomes much more readable for tickets that include inline email signatures.
- Logic: canonical text normalization remains deterministic, but now formats signature blocks instead of fully flattening them.
- Data: newly generated `ticket_text_artifact.text_clean` values may contain intentional line breaks for signature/contact formatting.

# Files touched
- `apps/api/src/services/prepare-context.ts`
- `apps/api/src/__tests__/services/prepare-context.test.ts`

# Date
2026-02-24
