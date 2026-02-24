# Concurrency Review Checklist (Cerebro)

Use this checklist when reviewing a candidate concurrency/race bug in `apps/api`.

## 1. Classify the Race Type

- Duplicate execution (same ticket/session processed twice)
- Lost update (later write overwrites earlier state unexpectedly)
- Check-then-act race (decision made on stale read)
- Reentrancy overlap (timer or background function invoked while prior run still active)
- Context leakage (`tenantContext` / `AsyncLocalStorage` wrong or missing)
- Idempotency gap (retries create duplicate rows or side effects)

## 2. Identify Shared State

- Postgres row/table (`triage_sessions`, `llm_outputs`, `validation_results`, `playbooks`)
- In-memory flags (`isPolling`, interval IDs)
- In-memory cache (`CacheService`)
- External rate-limit/quota budget (LLM providers)

## 3. Check Existing Guards

- In-memory flags only (local process only)
- `UNIQUE` constraints or natural idempotency key
- Conditional `UPDATE ... WHERE status = ...`
- Transaction boundary covers full critical section
- Row lock (`FOR UPDATE`) used when needed
- Queue-like fetch uses `SKIP LOCKED` when multiple workers can compete

## 4. Reproduction Checklist

- Reproduce with concurrent requests or forced overlap
- Capture logs with IDs and timestamps
- Snapshot rows before and after
- Repeat 5-20 times (races can be probabilistic)
- Verify whether issue requires multiple API instances

## 5. Fix Selection Order

1. Make DB write atomic
2. Add DB-enforced uniqueness/invariant
3. Add row locking / worker coordination
4. Add idempotency handling for retries
5. Keep in-memory flags only as optimization/noise reduction

## 6. Regression Coverage

- Add/extend unit or integration test for interleaving
- Add retry/duplicate invocation case
- Assert final persisted state, not only response code
- Test both “happy path” and “already processing/already exists” path

## Reporting Format

- Candidate:
- Why it races (interleaving):
- Evidence:
- Impact:
- Recommended fix:
- Validation after fix:

