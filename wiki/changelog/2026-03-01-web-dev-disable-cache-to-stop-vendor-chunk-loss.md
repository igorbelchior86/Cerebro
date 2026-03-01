# Web Dev Disable Cache To Stop Vendor Chunk Loss

# What changed
- Disabled webpack cache in development via `next.config.js`.

# Why it changed
- The local Next.js dev runtime kept failing with different missing files under `.next/server/vendor-chunks` after recompilations.
- Cleaning `.next` at startup reduced boot failures, but did not stop chunk loss during subsequent hot reload and route compilation cycles.

# Impact (UI / logic / data)
- UI: Reduces `Server Error` screens caused by missing generated route chunks during local development.
- Logic: No product logic changed; only development-time build/runtime behavior changed.
- Data: No persistence or data-model impact.

# Files touched
- `apps/web/next.config.js`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
- 2026-03-01
