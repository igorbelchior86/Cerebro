# State Modeling (Replace Boolean Soup)

## Symptoms
- Multiple `@State Bool` that should be mutually exclusive.
- UI logic like: `if isDeletingAll || isLoggingOut { ... }`.

## Fix pattern
Use a single modeled state.

Example:
- `enum BusyOperation { case none, deleteProfile, deleteAll, logout }`
- `struct ScreenState { var busy: BusyOperation; var alert: AlertState?; ... }`

## Acceptance criteria
- No invalid state combinations.
- Loading overlays and disabling are derived from **one** state.
- Alerts are modeled (`AlertState`) and emitted from the VM.
