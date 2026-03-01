# Web Dev Clears Stale Next Cache Before Start

# What changed
- Updated the stack startup script to remove `apps/web/.next` before launching `next dev`.
- This forces regeneration of server vendor chunks and other generated dev artifacts on every official stack start.

# Why it changed
- The web runtime failed with `Cannot find module './vendor-chunks/@opentelemetry+api@1.9.0.js'` from `apps/web/.next/server/webpack-runtime.js`.
- The root cause was a stale or corrupted `.next` artifact set being reused across restarts.

# Impact (UI / logic / data)
- UI: Prevents full-page `Server Error` screens caused by missing generated chunks in local development.
- Logic: No feature logic changed; only the deterministic startup behavior of the local web runtime changed.
- Data: No runtime data model or persistence impact.

# Files touched
- `scripts/stack.sh`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-01
