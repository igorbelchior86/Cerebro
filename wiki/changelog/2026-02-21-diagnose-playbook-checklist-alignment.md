# Diagnose-to-Playbook Checklist Alignment
# What changed
- Enforced checklist-to-hypothesis mapping in playbook generation using explicit hypothesis tags (`[H1]`, `[H2]`, `[H3]`).
- Added alignment validator to block outputs that do not cover material hypotheses (confidence >= 0.60).
- Added one constrained regeneration pass when first output is misaligned.

# Why it changed
- Prevent playbooks where hypotheses indicate multiple plausible causes but checklist addresses only one generic track.

# Impact (UI / logic / data)
- UI: checklist content is more traceable to hypotheses.
- Logic: stronger contract between diagnose and playbook stages.
- Data: unchanged.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/playbook-writer.ts
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/features/diagnose-playbook-checklist-alignment.md

# Date
- 2026-02-21
