# Title
Stack restart warning cleanup for Docker Compose

# What changed
- Removed deprecated `version` field from `docker-compose.yml`.
- Updated `scripts/stack.sh` to start infra with `--remove-orphans`.

# Why it changed
- `scripts/stack.sh restart` was showing noisy warnings about obsolete compose `version` and orphan containers.
- This caused confusion and looked like startup errors even though the stack was healthy.

# Impact (UI / logic / data)
- UI: no direct impact.
- Logic: startup flow is cleaner and deterministic.
- Data: no data model or runtime business logic change.

# Files touched
- `docker-compose.yml`
- `scripts/stack.sh`
- `tasks/todo.md`

# Date
2026-03-03
