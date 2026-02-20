# PrepareContext: No Zero-Score Device Fallback
# What changed
- Updated `resolveDeviceDeterministically` to reject device selection when top candidate score is below minimum reliability threshold.
- Removed behavior that implicitly selected the first available NinjaOne device when correlation score was `0.00`.
- Added unresolved-device tracking:
  - `missing_data` now includes `device_unresolved` with score context
  - `source_findings` explicitly records `no reliable device match; top score=...`
- Ensured downstream digest/playbook do not receive unrelated hostnames from arbitrary fallback.

# Why it changed
- A real ticket (`T20260220.0017`) incorrectly inherited device `DISCOZ220` even without org/requester/device correlation evidence.
- Root cause was deterministic fallback to first list item under zero-confidence matching.

# Impact (UI / logic / data)
- UI:
  - Playbooks no longer show unrelated hostname injected by zero-score fallback.
- Logic:
  - Device context now requires minimum correlation evidence.
  - Unresolved device state becomes explicit and auditable.
- Data:
  - `evidence_packs.payload.missing_data` gains `device_unresolved` in unresolved scenarios.
  - `source_findings` now exposes reliable/no-reliable device decision reason.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts

# Date
- 2026-02-20
