# Diagnose-to-Playbook Checklist Alignment
# What changed
- Updated playbook generation prompt to require explicit hypothesis tags in checklist steps: `[H1]`, `[H2]`, `[H3]`.
- Added mandatory mapping rule: each hypothesis with confidence >= 0.60 must have at least one checklist step.
- Added post-generation alignment validation in `playbook-writer`.
- Added a single repair pass: when alignment fails, regenerate once with explicit revision constraints.
- Added hard failure when alignment still fails after repair pass.

# Why it changed
- For ticket `T20260220.0018`, hypotheses covered hardware/network/identity but checklist focused mostly on generic hardware actions.
- The existing contract did not force hypothesis-to-step coverage.

# Impact (UI / logic / data)
- UI: checklist text now tends to include hypothesis tags, making rationale traceable.
- Logic: playbook output is now gated by hypothesis coverage alignment.
- Data: no schema changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/playbook-writer.ts

# Date
- 2026-02-21
