# 2026-02-21 Round0 Canonical Requester/Affected
# What changed
- Round 0 now extracts and sets canonical requester/affected identity fields.
- Enrichment prioritizes these canonical fields over raw requester channel value.
- Added test coverage for canonical identity precedence.

# Why it changed
- Ensure pipeline starts from correct user identity and avoids channel-sender bias.

# Impact (UI / logic / data)
- UI: requester/affected fields become user-realistic.
- Logic: improved user-device matching input quality.
- Data: identity provenance explicitly tracked at round 0.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/prepare-context-device-resolution.test.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/wiki/features/round0-canonical-requester-affected-identity.md`

# Date
- 2026-02-21
