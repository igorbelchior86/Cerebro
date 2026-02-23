# Step 2F Final IT Glue Ninja Refinement Guided By Gaps Conflicts
# What changed
- Added a final refinement pass (`round 9`) in `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts` that runs after fusion (`2d`) and history correlation/calibration (`2e`).
- The pass builds a targeted refinement plan from:
  - unresolved/conflicted enrichment fields
  - `missingData`
  - `fusion_audit.conflicts`
  - `ticket_context_appendix.history_confidence_calibration` (decreases/contradictions)
  - `ticket_context_appendix.history_correlation.search_terms`
- IT Glue final pass:
  - performs targeted `searchDocuments(...)` queries with refinement terms
  - merges accepted org-scoped docs into evidence context
- Ninja final pass:
  - conditionally re-runs deterministic device resolution when endpoint/network targets indicate potential missed correlation
  - refreshes Ninja context signals for the selected/refined device
- Added conservative deterministic backfill on enrichment fields (only updates when confidence objectively improves), including:
  - infra make/model fields (firewall/wifi/switch)
  - ISP / phone provider
  - endpoint device/os/last_check_in/user_signed_in
  - VPN state / public IP
- Recomputes evidence digest and iterative enrichment coverage/rounds after final refinement.
- Added appendix metadata `ticket_context_appendix.final_refinement` (targets, terms, additions, updated fields).

# Why it changed
- The contract for `2f` requires a last pass in IT Glue and Ninja with all gathered context in hand, to verify nothing was missed and to backfill remaining gaps.
- This final pass prevents leaving easily recoverable data in `unknown/conflict` after fusion + history calibration.

# Impact (UI / logic / data)
- UI/API: `ticket_context_appendix` can now expose `final_refinement` diagnostics for advanced inspection/debugging.
- Logic: `PrepareContext` performs a targeted backfill/verification pass before persisting final SSOT/Evidence Pack.
- Data: No new table in this change; appendix payload schema expanded with `final_refinement`.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`

# Date
- 2026-02-23
