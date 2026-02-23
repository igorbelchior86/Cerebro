# Triage Retry Backoff and Credential Failures
# What changed
- Added retry metadata fields (`retry_count`, `next_retry_at`, `last_error`) to `triage_sessions`.
- Pending retry selection now respects `next_retry_at` and uses exponential backoff with a capped delay.
- Credential/configuration errors are no longer treated as transient retries.

# Why it changed
- Prevent retry loops from hammering providers when transient failures persist.
- Make retry behavior observable and bounded without terminalizing transient failures.
- Avoid masking misconfiguration as retriable API errors.

# Impact (UI / logic / data)
- UI: No direct visual change; status remains `pending` for transient API failures.
- Logic: Retry loop respects `next_retry_at` and increments `retry_count` with backoff.
- Data: `triage_sessions` now stores retry metadata and last error message.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/triage-orchestrator.ts
- /Users/igorbelchior/Documents/Github/Cerebro/init.sql
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/db/migrations/008_triage_retry_fields.sql
- /Users/igorbelchior/Documents/Github/Cerebro/scripts/test-quota-retry.ts
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/features/triage-retry-backoff-and-credential-failures.md

# Date
- 2026-02-23
