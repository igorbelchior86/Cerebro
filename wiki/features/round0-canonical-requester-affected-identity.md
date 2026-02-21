# Round 0 Canonical Requester/Affected Identity
# What changed
- Extended Round 0 ticket normalization to extract canonical identity fields:
- `requester_name`, `requester_email`
- `affected_user_name`, `affected_user_email`
- Pipeline now persists these canonical values in working ticket context before enrichment rounds.
- Ticket enrichment now prioritizes Round 0 canonical identity over raw intake requester channel metadata.
- Added Round 0 provenance details in `source_findings` for canonical requester/affected values.

# Why it changed
- Intake requester metadata can represent channel/system sender, not real affected end-user.
- Device/user correlation and playbook relevance require canonical user identity at pipeline start.

# Impact (UI / logic / data)
- UI: Ticket section now reflects canonical requester/affected identity from Round 0.
- Logic: Early rounds use real user identity for correlation.
- Data: Better traceability of identity origin (`round0.canonical_*`).

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/prepare-context-device-resolution.test.ts`

# Date
- 2026-02-21
