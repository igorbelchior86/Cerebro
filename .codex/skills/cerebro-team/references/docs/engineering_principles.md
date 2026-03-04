# Engineering Principles for the Cerebro Team

These rules are mandatory. The orchestrator must enforce them in every change, and each specialist must explicitly confirm compliance (or document a justified exception).

## 1) Separation of concerns and modular boundaries
- Changes must respect module boundaries.
- UI, domain logic, integrations, and persistence concerns must not bleed into each other.
- If a change crosses boundaries, introduce an interface/adapter and document why.

## 2) Low coupling, high cohesion
- Prefer small, well-defined interfaces over shared mutable state.
- Use abstractions only where they reduce coupling or improve testability.
- Avoid “god modules” and cross-cutting utility buckets.

## 3) Readability
- Clear, descriptive names. Avoid ambiguous abbreviations.
- Behavior must be explicit; avoid “magic” implicit behavior.
- Comments explain **why**, not what (unless it is non-obvious or safety-critical).

## 4) Simplicity (KISS, YAGNI)
- Prefer the simplest design that meets Acceptance Criteria.
- Do not build speculative generalization.
- If optional complexity is proposed, it must be justified by an immediate need.

## 5) Correctness guardrails
- Validate inputs early (fail fast where safe).
- Handle expected failures cleanly (timeouts, retries, rate limits, partial outages).
- Add tests for critical paths and high-risk logic.

## 6) Change safety
- Refactor continuously in small increments.
- Keep public APIs stable. If breaking is necessary: version it or add a compatibility layer.
- Avoid broad refactors in the same PR as feature logic unless required for safety.

## 7) Operational safety (prod)
- Add logs/metrics/traces for new or changed behavior that can fail.
- Ensure correlation IDs flow through boundaries.
- Define degraded mode behavior for upstream dependencies (connectors, Redis).

## 8) Hygiene
- Formatter + linter must be clean.
- Avoid magic values; use constants/config.
- Minimize unnecessary dependencies; justify any new dependency.
- Prefer small, auditable helpers over large libraries.

## 9) Data safety (if data)
- Schema changes require versioning + migrations.
- Migrations must be reversible when feasible, or have a rollback strategy.
- Backfill plans must be explicit and safe for multi-tenant data.
