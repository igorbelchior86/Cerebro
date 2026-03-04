# EVIDENCE_PACK (Template)

## Tests
- Unit:
- Integration:
- Contract (API):
- Connector tests (if applicable):
- UI smoke (if applicable):

## AI Replay / Eval (if applicable)
- Golden cases updated? yes/no
- Replay suite results:
- Regressions observed:
- Mitigations:

## Observability
- Logs added/updated (structured, correlation id):
- Metrics added/updated:
- Traces added/updated (external calls):

## Performance / Reliability
- Redis fallback verified:
- Circuit breaker behavior verified:
- Rate limiting / retries validated:

## UI Evidence (if applicable)
- Screenshots:
- Error/loading states verified:

## Rollback / Degraded Mode
- Rollback steps:
- Degraded mode behavior:
- Trigger conditions (when to rollback):

## Engineering Principles Compliance (full justification — owned by Reliability)
For each principle: PASS/FAIL + 1–2 lines of justification. If FAIL, document mitigation or redesign required.

- Separation of concerns and modular boundaries: PASS/FAIL — [notes]
- Low coupling, high cohesion: PASS/FAIL — [notes]
- Readability (names, explicit behavior, comment why): PASS/FAIL — [notes]
- Simplicity (KISS/YAGNI): PASS/FAIL — [notes]
- Correctness guardrails (input validation, error handling, tests): PASS/FAIL — [notes]
- Change safety (stable APIs, safe refactor): PASS/FAIL — [notes]
- Operational safety (logs/metrics/traces, correlation ids): PASS/FAIL — [notes]
- Hygiene (formatter/linter, no magic values, deps): PASS/FAIL — [notes]
- Data safety (versioning/migrations, rollback): PASS/FAIL/NA — [notes]
