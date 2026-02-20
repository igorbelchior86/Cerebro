---
name: Hardening - Arquiteto/Auditor
description: Harden a codebase to pass large-team (“enterprise”) architecture review
execution_mode: DETERMINISTIC_LOW_TEMPERATURE (0.0 - 0.1)
---

# Architecture Hardening (Enterprise Standard)

## Non-negotiables
- Do **not** remove functionality unless the user explicitly requests it.
- Prefer small, safe refactors with measurable acceptance criteria.
- Assume you have **no context** beyond what the user provides and what you can read from the repo.

## Default operating mode (IDE)
- This skill assumes the project is **already unpacked** on disk (the normal Codex IDE/CLI workflow).
- Work against the current repository tree in the workspace.
- If an archive snapshot exists (e.g., `Archive.zip`), treat it as **optional reference** only (useful for diffing or forensics), not the default input.

## Inputs
- A repository workspace (unpacked project) with source code.
- Optional: an archive snapshot for comparison.

## Outputs (deliverables)
In addition to the response, always create/update this repo file:
- `artifacts/ARCHITECTURE_HARDENING.md` (single source of truth for the engineer skill)

1. **Boundary map** (modules/layers, allowed imports, dependency direction).
2. **Hardening findings** with severity (Blocker / High / Medium / Low) and concrete examples (file paths, symbols).
3. **Hardening plan**: ordered steps that preserve behavior; each step has:
   - scope,
   - expected diff shape,
   - acceptance criteria,
   - tests to add/adjust.
4. **PR gates**: automated checks and a PR checklist the team can enforce.
5. Optional: **patches** (small refactors) if the user asks you to implement.

## Workflow (step-by-step)

### Step 1 — Establish the “truth” workspace
- Treat the **current workspace repo tree** as the source of truth.
- Detect build system + module structure (SwiftPM targets, Xcode projects, etc.).
- If an archive snapshot exists, use it only to:
  - confirm historical layout,
  - compare “then vs now” when investigating regressions.

### Step 2 — Identify architecture shape
Produce a quick inventory:
- modules/packages (SwiftPM, Gradle, etc.),
- UI entry points / composition root,
- data layer (persistence),
- sync/networking/integrations,
- design system,
- test targets.

Write this as a **boundary map draft** using `references/boundary-map.md` as a template.

### Step 3 — Enforce dependency direction (“no back edges”)
Check for violations:
- external SDKs imported in UI,
- UI importing persistence/network implementations instead of protocols,
- Core/Domain importing UI or vendor SDKs,
- cyclic dependencies.

If scripts are available, run `scripts/audit_swift_repo.sh <repo-root>` to surface common offenders fast.

### Step 4 — DI hardening
Deliver a DI standard that prevents regressions:
- protocols in Domain/Core,
- implementations in Data/Sync,
- wiring in Composition Root,
- Views get ViewModels; ViewModels get protocols only.

Use `references/di-standard.md`.

### Step 5 — State modeling hardening
Replace fragile state “boolean soup” with modeled state:
- operation enums,
- view state structs,
- alert state structs,
- single source of truth per screen.

Use `references/state-modeling.md`.

### Step 6 — Concurrency hardening
Pick one model and enforce it:
- async/await end-to-end in new/modified flows,
- isolate `DispatchQueue` in adapters,
- UI updates via `@MainActor`,
- structured cancellation.

Use `references/concurrency-standard.md`.

### Step 7 — Performance hardening (UI render loop)
Ban heavy work in render paths:
- no large map/filter/reduce in SwiftUI `body`,
- precompute aggregates in ViewModels/services,
- cache with invalidation on source change.

Provide concrete refactor suggestions for the worst hotspots.

### Step 8 — PR gates + tests
Define “merge-ready” gates:
- dependency checks,
- dead-code check (if available),
- lint rules (imports, prints),
- minimum unit tests for new domain logic,
- VM tests for critical flows.

Use `references/pr-gates.md` + `assets/PR_TEMPLATE.md`.

## Reporting format (use this structure in responses)
- **Boundary Map (proposed)**: bullets + allowed import directions
- **Blockers**: 3–10 items, each with file path(s) and a fix
- **High** / **Medium** / **Low**
- **Plan (ordered)**: Step 1..N, each with acceptance criteria + tests
- **PR Gates**: what to automate, what to enforce in review

## Example prompts to trigger this skill
- “Harden this repo for enterprise review; enforce boundaries and DI.”
- “ContentView is huge. Create an enterprise refactor plan with PR gates.”
- “Move vendor SDK imports out of UI and prevent regressions.”

## Troubleshooting
- If build is broken, still deliver:
  - boundary map,
  - dependency violations,
  - refactor plan,
  - PR gates.
- Prefer the smallest enforceable change that creates testable seams.
