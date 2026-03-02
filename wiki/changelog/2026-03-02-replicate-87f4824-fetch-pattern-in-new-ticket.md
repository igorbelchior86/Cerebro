# Replicate 87f4824 Fetch Pattern in New Ticket Context Editor
# What changed
- Updated `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx` context editor fetch effect to mirror the direct pattern used in commit `87f4824` (`triage/[id]`).
- Removed timer/debounce path and executed fetch immediately inside effect.
- Removed in-effect suggestion cache merge writes for Org/Primary/Secondary in the fetch path.
- Kept contact/org guard and ticket-field cached branch behavior.
- Changed technician search call to `searchAutotaskResources(contextEditorQuery, 30)` (fixed limit), matching investigated pattern.

# Why it changed
- User reported persistent spinner/flicker regression.
- Investigated commit `87f4824` and extracted its concrete working fetch behavior.
- New Ticket flow was still using a more complex fetch path (hydration/debounce/cache merge), increasing loading churn.

# Impact (UI / logic / data)
- UI: New Ticket context editor now follows direct fetch flow and avoids extra loading churn from timer/cache-merge in the critical path.
- Logic: Effect now runs immediate request with simpler dependency model.
- Data: No persistence/schema/API contract changes.

# Files touched
- apps/web/src/app/[locale]/(chat)/triage/home/page.tsx

# Date
- 2026-03-02
