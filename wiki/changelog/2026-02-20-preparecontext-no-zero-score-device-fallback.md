# Changelog: Remove Zero-Score Device Fallback
# What changed
- Fixed device correlation logic in `PrepareContext` to avoid selecting arbitrary first device when correlation score is zero.
- Added explicit unresolved-device recording (`device_unresolved`) and source finding reason.
- Reprocessed `T20260220.0017` and confirmed `DISCOZ220` is no longer injected into playbook context.

# Why it changed
- The previous fallback produced false device ownership inference in production-like ticket flow.

# Impact (UI / logic / data)
- UI: playbook content no longer includes unrelated fallback hostname.
- Logic: stricter deterministic device selection with minimum score guard.
- Data: unresolved device now appears as missing-data signal instead of incorrect positive match.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts

# Date
- 2026-02-20
