# Title
Fix `scripts/stack.sh` hanging `status`/`restart` health checks

# What changed
- Added timeout-bounded `curl_health()` helper to `scripts/stack.sh`.
- Updated health checks in `wait_ready()` and `cmd_status()` to use the helper.

# Why it changed
Unbounded `curl` calls to `http://localhost:3000` could block indefinitely, causing `status` and `restart` to appear frozen.

# Impact (UI / logic / data)
- UI: none.
- Logic: shell script health checks now terminate quickly on slow/non-responsive endpoints.
- Data: none.

# Files touched
- `scripts/stack.sh`

# Date
2026-02-24
