# SSOT Company Domain Fallback Override Fix
# What changed
- Updated `PrepareContext` company selection to avoid prioritizing domain-derived intake company labels when a better inferred company name is available.
- Updated SSOT anti-regression logic to preserve `ticket.company` only when it is not a likely domain-derived fallback, or when no better display-ready company candidate exists.
- Added narrow heuristics to detect likely domain-derived company labels (e.g. concatenated domain-root style names like `Garmonandcompany`).

# Why it changed
- The UI was still showing domain-derived company names even after SSOT-focused fixes because the pipeline preserved degraded intake fallback values as if they were canonical company names.
- The architecture contract requires UI to be SSOT-only, so the fix must happen in `PrepareContext`/SSOT assembly.

# Impact (UI / logic / data)
- UI: Company name cards/labels should now display the real inferred company name instead of a domain-derived fallback when available.
- Logic: `PrepareContext` now distinguishes between high-quality intake company names and low-quality domain-derived fallbacks.
- Data: `ticket_ssot.payload.company` will prefer a better display-ready company value when intake company looks domain-derived.

# Files touched
- `apps/api/src/services/prepare-context.ts`

# Date
- 2026-02-24

