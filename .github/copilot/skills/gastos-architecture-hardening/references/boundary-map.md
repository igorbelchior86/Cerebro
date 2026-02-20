# Boundary Map Template

Fill this out after scanning the repo.

## Modules / layers
List each module (package/target) and its role.

Example (adjust to the repo):
- **Domain/Core**: pure models + business rules + protocols
- **Design**: UI components + tokens
- **Data**: persistence, DTOs, local cache
- **Sync**: networking/vendor SDK integrations
- **App/UI**: composition root, SwiftUI views, navigation, view models

## Allowed dependency direction
Write as arrows.

Example:
- App/UI -> Domain/Core
- App/UI -> Design
- App/UI -> Data (only via protocols), Sync (only via protocols)
- Data -> Domain/Core
- Sync -> Domain/Core
- Design -> Domain/Core
- Domain/Core -> (nothing)

## Prohibited imports (enforced)
List concrete ban rules (by package):
- UI must not import vendor SDKs (Firebase, etc.)
- Domain/Core must not import SwiftUI/UIKit
- Data/Sync must not import SwiftUI

## Seam contracts (protocols)
List the key protocols that make the architecture testable:
- AuthSession
- TransactionsRepository
- SyncEngine
- NotificationScheduling
