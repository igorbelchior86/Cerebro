---
name: cerebro-concurrency-race-auditor
description: Audit and stress-test race conditions and concurrency bugs in the Cerebro (Playbook Brain) Node/TypeScript monorepo, especially apps/api pollers, background orchestration, AsyncLocalStorage tenant context, and Postgres state transitions. Use when Codex needs to investigate duplicate processing, overlapping timers, async reentrancy, lost updates, idempotency gaps, stale retry loops, or concurrency regressions in routes/services/tests.
---

# Cerebro Concurrency Race Auditor

## Overview

Audit logical concurrency problems in this repo with a repeatable workflow focused on `apps/api`.
Prioritize duplicate work, async reentrancy, status-transition races, and multi-worker DB contention over CPU-thread data races.

## Quick Start

1. Run the hotspot scan first.
2. Build a race matrix for the top files.
3. Reproduce one candidate with concurrent requests or repeated timer-triggered execution.
4. Propose fixes using atomic DB transitions, idempotency, or stricter guards.
5. Re-run targeted tests and document findings.

```bash
python3 .codex/skills/cerebro-concurrency-race-auditor/scripts/concurrency_hotspots.py
node .codex/skills/cerebro-concurrency-race-auditor/scripts/http_burst.mjs --help
```

## Workflow

## 1. Establish Scope

Audit `apps/api` first. Treat these areas as high-risk:

- Polling/timers (`setInterval`, retry listeners, background loops)
- Route handlers that launch background work after returning responses
- Shared in-memory state (`Map`, singleton services, flags like `isPolling`)
- DB check-then-act flows (`SELECT` then `UPDATE`/`INSERT` without atomic guard)
- Retry/backoff and session status transitions
- Async context propagation (`AsyncLocalStorage` / `tenantContext`)

Read `references/cerebro-api-hotspots.md` before deep investigation.

## 2. Run Static Hotspot Scan

Use the bundled script to rank files and show line-level pattern hits.

```bash
python3 .codex/skills/cerebro-concurrency-race-auditor/scripts/concurrency_hotspots.py
```

Use `--json` when you need structured output for another script or report.

```bash
python3 .codex/skills/cerebro-concurrency-race-auditor/scripts/concurrency_hotspots.py --json
```

## 3. Build a Race Matrix (Per Candidate)

For each high-priority candidate, document:

- Shared resource: row/table, cache key, in-memory flag, external API quota bucket
- Concurrent actors: request handlers, poller loop, retry listener, manual rerun, multiple app instances
- Critical section: read, decision, write sequence
- Existing guard: `isPolling`, status checks, unique constraint, retry field, tenant context
- Failure mode: duplicate insert, lost update, stale overwrite, double-processing, wrong tenant context
- Reproduction path: concurrent HTTP burst, timer overlap, forced retry, DB seed state

Use `references/concurrency-review-checklist.md` as the checklist.

## 4. Reproduce Suspected Races

Use targeted bursts against safe endpoints or test-only routes. Prefer non-destructive paths.

```bash
node .codex/skills/cerebro-concurrency-race-auditor/scripts/http_burst.mjs \
  --url http://localhost:3001/health \
  --concurrency 20 \
  --rounds 5
```

For protected routes, provide headers/cookies explicitly and use a safe test tenant/session.

Important:

- Prefer local/dev data.
- Avoid endpoints that trigger irreversible actions.
- Capture request/response timestamps and DB row state before/after.

## 5. Validate Atomicity and Reentrancy

Inspect code for these project-specific patterns:

- `SELECT ... ORDER BY ... LIMIT 1` followed by `UPDATE` in separate statements
- Status transitions without compare-and-set semantics (`WHERE status = ...`)
- Pollers guarded only by in-memory flags (`isPolling`) without cross-process protection
- Background triggers that can run in parallel with orchestrator retries
- Multiple services writing the same `triage_sessions`, `llm_outputs`, `validation_results`, or `playbooks` rows

Prefer fixes in this order:

1. Atomic SQL (`UPDATE ... WHERE status = 'pending' RETURNING *`)
2. Row locks (`FOR UPDATE`, optionally `SKIP LOCKED` for worker-queue behavior)
3. Idempotency keys / unique constraints
4. DB-enforced invariants
5. In-memory flags (only as local-process guard, never as sole correctness mechanism)

See `references/context7-basis.md` for the Node/Postgres documentation summary used by this skill.

## 6. Verify and Report

Run only targeted checks needed for the affected area (usually `apps/api` tests).

Examples:

```bash
pnpm --filter @playbook-brain/api test -- --runInBand
pnpm --filter @playbook-brain/api test -- --testPathPattern=triage
pnpm --filter @playbook-brain/api typecheck
```

Report findings first, ordered by severity. Include:

- File and line
- Race hypothesis (what interleaving breaks)
- Reproduction evidence
- Blast radius
- Recommended fix (atomic SQL / lock / idempotency / sequencing)

## Project Notes

- JavaScript on Node is single-threaded per event loop, but this project still has concurrency risk from async interleavings, timers, concurrent requests, and multi-instance deployments.
- `AsyncLocalStorage` protects tenant context only if the async chain stays within the expected context boundaries.
- Poller `isPolling` flags prevent overlap only inside one process. They do not prevent duplicate work across multiple API instances.
- Prioritize `apps/api/src/services/triage-orchestrator.ts`, `apps/api/src/services/*polling.ts`, and background processing inside `apps/api/src/routes/playbook.ts`.

## Resources

### scripts/

- `scripts/concurrency_hotspots.py`: Static heuristic scanner for concurrency hotspots in `apps/api/src`
- `scripts/http_burst.mjs`: Concurrent HTTP burst generator for reproducing async interleavings

### references/

- `references/cerebro-api-hotspots.md`: Project-specific hotspots and why they matter
- `references/concurrency-review-checklist.md`: Repeatable review checklist and evidence format
- `references/context7-basis.md`: Documentation basis (Node AsyncLocalStorage, Postgres row locking)

