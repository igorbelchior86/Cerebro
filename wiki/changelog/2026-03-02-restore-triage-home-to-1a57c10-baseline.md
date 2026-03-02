# Restore New Ticket Primary Tech Flow to 1a57c10 Baseline
# What changed
- Restored `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx` to the exact content from commit `1a57c10`.
- Removed subsequent local iterations for the context-editor search loop in this file by replacing with known-good baseline implementation.

# Why it changed
- User reported persistent regression after multiple attempts.
- Commit `87f4824` was investigated and does not modify `triage/home` (it only touches triage detail/chat scroll files), so it could not serve as direct baseline for this bug.
- Last known working lineage for this specific flow is `1a57c10`, so rollback-to-known-good was applied.

# Impact (UI / logic / data)
- UI: New Ticket context editor (`Primary/Secondary`) behavior is restored to known-good baseline.
- Logic: Search/loading behavior returns to previous proven implementation.
- Data: No schema, API contract, or persistence changes.

# Files touched
- apps/web/src/app/[locale]/(chat)/triage/home/page.tsx

# Date
- 2026-03-02
