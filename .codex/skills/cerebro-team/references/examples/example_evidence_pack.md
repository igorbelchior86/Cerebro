# Example: Evidence Pack (Feature — Connector Rate-Limit Backoff)

> This example accompanies `example_change_brief_feature.md`.
> It shows a fully filled EVIDENCE_PACK for a backend feature change.
> Use it as a reference when completing Phase 5 of the orchestration workflow.

---

## EVIDENCE_PACK

**Change:** Add configurable exponential backoff for Autotask connector write failures
**Primary owner:** BackendLead
**Date:** 2025-07-14
**Evidence compiled by:** Reliability

---

### 1. Acceptance criteria coverage

| # | Acceptance Criterion | Status | Evidence |
|---|----------------------|--------|----------|
| 1 | Connector retries failed writes up to N times (configurable) | ✅ PASS | `apps/api/src/connectors/autotask/writer.ts` — `withRetry()` wrapper, config via `AUTOTASK_MAX_RETRIES` env var |
| 2 | Backoff delay doubles per attempt, capped at 30 s | ✅ PASS | `withRetry()` implementation; unit test `writer.test.ts:42` validates cap |
| 3 | Permanent failures (4xx) are not retried | ✅ PASS | `isRetryable()` guard; test `writer.test.ts:67` asserts 400 does not retry |
| 4 | All retry attempts are logged with correlation ID | ✅ PASS | Structured log line `connector.write.retry` emitted in `withRetry()`; verified in integration test |

---

### 2. Gate status

| Gate | State | Evidence / Justification |
|------|-------|--------------------------|
| Contract Gate | OFF | No API response shape or shared type changes |
| Tenant Isolation Gate | N/A | `tenant_id` appears in test mocks only; no scoping logic changed. Acknowledged by Reliability. |
| Connector Write-Safety Gate | **ON → PASS** | See section 3 |
| AI Replay Gate | OFF | No prompt, tool, or agent logic touched |
| Observability Gate | **ON → PASS** | See section 4 |

---

### 3. Connector Write-Safety Gate — evidence

- **Dry-run / safe mode:** Retry wrapper wraps existing `writeTicket()` call; no new write surface introduced.
- **Idempotency:** Autotask ticket creation is idempotent on duplicate external reference ID. Confirmed with Autotask sandbox (test run ID `at-sandbox-2025-07-14-001`).
- **Integration tests:** `apps/api/src/connectors/autotask/__tests__/writer.integration.test.ts` — 6 cases covering success, retry-then-success, and permanent failure. All pass against mock server.
- **Retry/backoff documented:** Config values (`AUTOTASK_MAX_RETRIES`, `AUTOTASK_RETRY_BASE_MS`, `AUTOTASK_RETRY_CAP_MS`) documented in `apps/api/README.md#connector-config`.

---

### 4. Observability Gate — evidence

New structured log events emitted:

| Event | Fields | Level |
|-------|--------|-------|
| `connector.write.retry` | `correlationId`, `attempt`, `delayMs`, `errorCode` | warn |
| `connector.write.permanent_failure` | `correlationId`, `attempts`, `errorCode`, `errorMessage` | error |
| `connector.write.success_after_retry` | `correlationId`, `attempts` | info |

- Correlation IDs flow from Express middleware through `withRetry()` via `AsyncLocalStorage`. Verified in integration test `writer.integration.test.ts:88`.
- No new external calls added; traces not required for this change.

---

### 5. Validation run results

Run against `main` + this branch at commit `a3f9c12`:

```
pnpm -r lint        ✅  0 errors, 0 warnings
pnpm -r typecheck   ✅  0 errors
pnpm -r test        ✅  312 passed, 0 failed, 0 skipped
```

---

### 6. Principles compliance summary

| Principle | Status | Note |
|-----------|--------|------|
| Separation of concerns | PASS | Retry logic isolated in `withRetry()` utility; no bleed into domain layer |
| Low coupling | PASS | `withRetry()` is a generic wrapper with no connector-specific imports |
| Readability | PASS | Function name, param names, and log event names are self-describing |
| Simplicity (KISS/YAGNI) | PASS | Simplest retry strategy that meets AC; no circuit-breaker added (not required) |
| Correctness guardrails | PASS | `isRetryable()` prevents retrying non-transient errors |
| Change safety | PASS | No public API changes; wrapper is additive |
| Operational safety | PASS | All retry paths emit structured logs with correlation ID |
| Hygiene | PASS | Lint/typecheck clean; no new dependencies |
| Data safety | PASS | No schema changes |

Full per-agent compliance details are inline in the ORCHESTRATION_REPORT.

---

### 7. Rollback plan

- Revert commit `a3f9c12` (single commit, no migration).
- `AUTOTASK_MAX_RETRIES=0` can be set to disable retries without a deploy (feature-flag via env var).

---

### 8. Open risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Retry storms if many tenants hit Autotask rate limits simultaneously | Medium | Cap total delay at 30 s; monitor `connector.write.retry` alert if rate > 50/min |

---

**Evidence Pack status: ✅ READY FOR MERGE**
All required gates PASS. Validation run clean. Acceptance criteria covered.
