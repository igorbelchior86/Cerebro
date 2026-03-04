# Example Change Brief (Bugfix)

Problem:
- Autotask ticket sync occasionally duplicates notes when retries happen.

Goal:
- Ensure note writes are idempotent and duplicates cannot occur on retry.

Non-goals:
- No refactor of the entire connector architecture.

Scope:
In:
- Autotask note write path
- idempotency key generation
Out:
- UI changes

Systems touched:
- API: yes
- DB: maybe (store idempotency keys)
- Redis/cache: no
- AI/agents: no
- UI/web: no
- Connectors: Autotask (write)

Risk level: Med

AC:
- Replaying the same write request results in a single note in Autotask.
- Retries do not create duplicates.
- Logging includes correlation_id + idempotency_key.

Rollback:
- Feature flag to revert to old behavior.

Evidence:
- Integration test with mocked Autotask
- Contract tests for connector method
- Log sample
