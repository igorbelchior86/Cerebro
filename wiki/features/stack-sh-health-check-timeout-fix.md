# Title
`scripts/stack.sh` health-check timeout fix for `status`/`restart`

# What changed
- Added a shared `curl_health()` helper in `scripts/stack.sh` with bounded timeouts:
  - `--connect-timeout 1`
  - `--max-time 2`
- Replaced direct `curl` health checks in:
  - `wait_ready()`
  - `cmd_status()`

# Why it changed
`./scripts/stack.sh status` could hang indefinitely when the web process accepted a TCP connection but did not return an HTTP response promptly. `restart` also appeared stuck because it calls the same health checks.

# Impact (UI / logic / data)
- UI: none.
- Logic: stack health checks now fail fast instead of hanging; `status` and `restart` complete predictably.
- Data: none.

# Files touched
- `scripts/stack.sh`

# Date
2026-02-24
