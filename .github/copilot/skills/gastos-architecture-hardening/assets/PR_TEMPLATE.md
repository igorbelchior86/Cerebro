# PR Checklist (Architecture Hardening)

## Summary
- What changed:
- Why:

## Boundaries
- [ ] No prohibited imports (vendor SDK in UI, UI in domain, etc.)
- [ ] Dependency direction preserved (no back edges)
- [ ] New protocols live in Domain/Core; implementations in Data/Sync

## DI
- [ ] No services instantiated inside Views
- [ ] ViewModels depend on protocols only
- [ ] Composition root wires dependencies

## State + Concurrency
- [ ] Modeled state (no boolean soup)
- [ ] async/await used consistently
- [ ] UI updates on MainActor; cancellation supported

## Performance
- [ ] No large aggregations in SwiftUI `body`
- [ ] Caches/invalidation documented

## Tests
- [ ] Unit tests added/updated
- [ ] VM tests added/updated (if user flow changed)

## Risk / Rollback
- Risks:
- Rollback plan:
