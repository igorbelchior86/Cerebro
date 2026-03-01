# API Bootstrap Load Env Before DB Pool
# What changed
- Updated the active Postgres module (`apps/api/src/db/index.ts`) to load the monorepo root `.env` before constructing the shared `pg` pool.
- Added the same early `.env` hydration to `apps/api/src/db/pool.ts` so both database entrypoints resolve runtime configuration consistently.

# Why it changed
- The API bootstrap imports database modules before `index.ts` can run `dotenv.config()`, so the pool was being created with the stale hardcoded fallback database (`cerebro`).
- On restart, that fallback pointed to a non-existent local database and crashed the API, which surfaced in the web app as HTTP 500 / proxy failures.

# Impact (UI / logic / data)
- UI: removes the proxy-side 500 caused by the API being down after restart.
- Logic: database pools now resolve `DATABASE_URL` from the configured `.env` during module initialization instead of falling back prematurely.
- Data: no schema change, no migration, no write-path change.

# Files touched
- `apps/api/src/db/index.ts`
- `apps/api/src/db/pool.ts`
- `tasks/lessons.md`
- `tasks/todo.md`

# Date
- 2026-03-01
