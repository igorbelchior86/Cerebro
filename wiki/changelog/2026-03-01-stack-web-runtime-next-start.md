# Stack Web Runtime Uses Next Start

# What changed
- Updated the local stack bootstrap script to build the web app before launch and start it with `next start` instead of `next dev`.
- The script still clears `apps/web/.next` first, but now it immediately regenerates a clean production build and serves that stable output.

# Why it changed
- The active runtime was still `next dev`, and it continued to corrupt `.next/server/vendor-chunks`, causing recurring `Cannot find module './vendor-chunks/...js'` crashes.
- Disabling webpack cache in development reduced risk but did not eliminate the issue in this environment.
- The stable production runtime had already been validated locally, so the correct fix was to make the official bootstrap use that runtime.

# Impact (UI / logic / data)
- UI: the local web app stops crashing with vendor-chunk module errors during normal use.
- Logic: `scripts/stack.sh up|restart` now performs a synchronous web build before starting the detached web server.
- Data: no schema or persisted data changes.

# Files touched
- `scripts/stack.sh`
- `tasks/todo.md`

# Date
- 2026-03-01
