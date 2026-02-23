# Step 2.5 UI Populated From SSOT And Context Appendix
# What changed
- Updated the triage session page `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx` to prioritize `ssot` as the primary source for UI rendering (ticket title/header meta, requester/company/device/network context).
- Added support for `ticket_context_appendix` in the frontend session data model and API response mapping.
- Enriched the middle timeline `PrepareContext` message with appendix-driven status summary (fusion field count, history match count, final refinement updates).
- Updated Playbook context cards to use SSOT infra/device fields (`firewall`, `wifi`, `switch`, `device`) and appendix metrics (`history matches`, `refinement fields`), falling back to `evidence_pack` only when SSOT is absent.

# Why it changed
- With `ticket_ssot` and `ticket_context_appendix` now available, the UI should consume canonical, stabilized values instead of reconstructing display state from mixed raw evidence payloads.
- This reduces UI inconsistency and makes the interface reflect the final curated context produced by steps `2a..2f`.

# Impact (UI / logic / data)
- UI: Header/meta/context cards/timeline status now align with the canonical SSOT and appendix artifacts.
- Logic: Frontend uses a clear precedence order (`ssot` → normalized ticket → sidebar/evidence fallback) rather than relying heavily on `evidence_pack`.
- Data: No schema changes in this step (frontend consumption only).

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`

# Date
- 2026-02-23
