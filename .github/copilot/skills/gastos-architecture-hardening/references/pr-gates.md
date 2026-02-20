# PR Gates (Enterprise)

## Automated (CI)
- Forbid vendor SDK imports outside allowed modules (grep/rg gate).
- Forbid `print(` in non-DEBUG builds.
- Forbid heavy aggregation in SwiftUI render paths (heuristic grep).
- Unit tests required for Domain/Core changes.
- ViewModel tests required for critical user flows.

## Manual review checklist
Use the PR template in `assets/PR_TEMPLATE.md`.
