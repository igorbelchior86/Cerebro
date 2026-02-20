# PR Gates (Implementation)

## Must-pass checks
- Forbidden imports by layer (UI must not import vendor SDK; Domain must not import SwiftUI/UIKit)
- No `print(` outside DEBUG
- DispatchQueue usage isolated (document exceptions)
- No heavy aggregation in SwiftUI `body` (heuristic gate)

## Required tests
- Domain/Core changes require unit tests
- Critical flows require VM tests or documented smoke checklist
