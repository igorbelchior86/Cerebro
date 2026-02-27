# Phase 1 Strict Closure Prompt Pack (Zero Exclusions)

## Non-negotiable closure rule
Phase 1 is complete only when **100% of Autotask API-manageable scope is implemented in engine**.

- Allowed final matrix status: `implemented`
- Forbidden at closure: `excluded_by_permission`, `excluded_by_api_limitation`

## Global constraints
- Use Sequential Thinking MCP.
- Use Context7 MCP for documentation lookup (if unavailable, document fallback).
- No UI changes.
- Keep launch policy unchanged: `Autotask=two_way`; `IT Glue/Ninja/SentinelOne/Check Point=read_only`.
- Any code change must update wiki in all four sections and `tasks/todo.md`.

---

## Prompt A — Exclusion Burn-Down Plan + Contract Expansion (Wave 0)

Mission:
- Read `docs/contracts/autotask-phase1-full-api-capability-matrix.md` and convert every `excluded_*` row into an implementation-ready item.

Scope (in):
- Produce a burn-down table: row -> required endpoint(s) -> required payload/validation -> target module -> test required.
- Expand contracts/types so each previously excluded row has concrete command/query schema.
- Keep backward compatibility aliases if required.

Scope (out):
- Implement runtime logic for all rows (belongs to B/C).

Acceptance:
- Matrix has no ambiguous rows.
- Every previously excluded row has an implementation contract.

Verification:
- `pnpm --filter @playbook-brain/types typecheck`
- Contract/schema tests if available.

---

## Prompt B — Engine Implementation for Newly Unblocked Operations

Mission:
- Implement gateway/core handlers for every previously excluded operation from Prompt A.

Scope (in):
- Add/expand operation registry and handler mapping.
- Implement client calls and payload mapping.
- Enforce idempotency and policy gate for all new writes.
- Ensure legacy compatibility where necessary.

Scope (out):
- Deep sync/reconcile behavior changes (Prompt C).

Acceptance:
- Every targeted operation executes via engine path.
- No new operation remains in `excluded_*` for implementation reasons.

Verification:
- `pnpm --filter @playbook-brain/api typecheck`
- Unit tests for new handlers and rejection paths.

---

## Prompt C — Sync/Reconcile/Retry Coverage for New Operation Surface

Mission:
- Extend sync normalization, reconciliation, and reliability behavior for newly implemented operations.

Scope (in):
- Domain snapshot ingestion for newly covered entities.
- Reconciliation classification and remediation signals by domain.
- Retry/backoff/DLQ policy coverage for new operation classes.
- Audit metadata and correlation IDs on failure/success paths.

Scope (out):
- New business commands not present in capability matrix.

Acceptance:
- New operation domains are sync/reconcile-capable and observable.
- No silent failure path.

Verification:
- `pnpm --filter @playbook-brain/api typecheck`
- Tests for retryable/non-retryable errors, degraded mode, reconcile classifications.

---

## Prompt D — Gate Closure Validator (Integrated)

Mission:
- Validate strict Phase 1 closure and produce evidence bundle.

Scope (in):
- Recompute matrix status and fail if any row is not `implemented`.
- Execute targeted test pack + typecheck.
- Execute live representative E2E proofs across operation classes.
- Produce artifacts: checklist, summary, manifest, logs.

Required outputs:
- `phase1-gate-checklist.md`
- `phase1-summary.md`
- `manifest.json`
- one reproducible evidence capture script

Strict acceptance:
- `excluded_by_permission = 0`
- `excluded_by_api_limitation = 0`
- all required checks pass
- launch policy regression check passes

Verification command baseline:
- `pnpm --filter @playbook-brain/api typecheck`
- targeted gate test suites
- launch policy suite

---

## Merge order
1. Prompt A
2. Prompt B and Prompt C in parallel (branch from A)
3. Prompt D integrated validation

## Stop condition
If any excluded row remains after B/C, Phase 1 stays **NOT MET**.
