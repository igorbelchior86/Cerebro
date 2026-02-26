# Title
Phase 4 Validation Evidence Flow (Workflow + Manager Ops P0 Snapshot Export)

# What changed
- Documented the internal validation evidence flow that reads existing P0 APIs (`/workflow/*`, `/manager-ops/p0/*`) and stores session snapshots in repo-native bundles under `docs/validation/runs/<timestamp>/`.
- Documented artifact boundaries between execution runbook/matrix/templates and evidence JSON capture utility.

# Why it changed
- Phase 4 validation required a consistent evidence architecture so acceptance scoring, QA review, and launch decisions use traceable outputs from existing P0 routes rather than ad-hoc manual notes/spreadsheets.

# Impact (UI / logic / data)
- UI: No direct UI change.
- Logic: Validation evidence collection is an external script-driven flow that calls protected APIs and writes files without mutating product state (except normal validation actions already performed by operators).
- Data: Evidence bundles contain API snapshots (`health`, workflow, manager-ops), manifest metadata, and linked manual notes/templates for QA/triage/decision packet completion.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/docs/validation/phase4-refresh/03-evidence-capture-procedure.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/docs/validation/phase4-refresh/02-p0-acceptance-matrix.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/docs/validation/phase4-refresh/04-qa-sampling-workflow.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/scripts/p0-validation-evidence-capture.mjs`

# Date
2026-02-26
