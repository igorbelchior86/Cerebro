# NinjaOne Fidelity Enrichment and Playbook Grounding
# What changed
- Corrected NinjaOne field mapping to read real device payload structures:
- OS from `os.name`
- OS version from `os.buildNumber` + `os.releaseId`
- Public IP from `publicIP` / `ipAddresses`
- Device type from `system.chassisType` and `nodeClass` before text heuristics
- Last login user/time sourced from official endpoint and persisted into endpoint enrichment (`user_signed_in`, `user_signed_in_at`).
- Extended NinjaOne collection with:
- `GET /v2/device/{id}/activities`
- `GET /v2/device/{id}/network-interfaces`
- `GET /v2/queries/software` (best-effort, filtered)
- Converted these sources into additional Ninja signals for grounding.
- Fixed Ninja round-3 source finding org ID consistency.
- Updated capability extraction to read hardware from `system.*` (`manufacturer`, `model`, `serial`) and expanded HP model rule coverage.
- Updated playbook prompt grounding to explicitly include known endpoint/capability facts and forbid redundant data-collection steps for already-known fields.

# Why it changed
- Playbooks were asking technicians to manually find hardware/endpoint facts that already existed in NinjaOne.
- Several fields were `unknown` due to incorrect key mapping despite data being available in NinjaOne payload.
- Cross-source org ID mismatch was causing valid Ninja context signals to be dropped by boundary filters.

# Impact (UI / logic / data)
- UI: Endpoint section now shows richer and correct fields (OS/version, laptop type, public IP, user last login with timestamp).
- Logic: Device/capability verification relies on canonical Ninja payload structures and official login endpoint.
- Data: More grounded evidence enters `signals` and `source_findings`, reducing redundant playbook steps.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/clients/ninjaone.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/playbook-writer.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/prepare-context-device-resolution.test.ts`

# Date
- 2026-02-21
