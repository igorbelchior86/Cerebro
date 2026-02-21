# 2026-02-21 NinjaOne Fidelity Enrichment and Playbook Grounding
# What changed
- Implemented official and structured NinjaOne mapping for endpoint enrichment.
- Added extended Ninja data collection (activities, network interfaces, software query) and signal generation.
- Fixed org-id consistency for Ninja round-3 source findings.
- Improved capability extraction using `system` subtree and expanded HP capability model matching.
- Added playbook prompt constraints to avoid asking for already-known endpoint/capability data.

# Why it changed
- Pipeline previously underused available Ninja data and produced playbooks with unnecessary manual discovery steps.

# Impact (UI / logic / data)
- UI: richer endpoint data with fewer `unknown` fields.
- Logic: stronger deterministic enrichment before diagnosis/playbook stages.
- Data: improved grounding and reduced redundant checklist generation pressure.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/clients/ninjaone.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/playbook-writer.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/prepare-context-device-resolution.test.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/wiki/features/ninjaone-fidelity-enrichment-playbook-grounding.md`

# Date
- 2026-02-21
