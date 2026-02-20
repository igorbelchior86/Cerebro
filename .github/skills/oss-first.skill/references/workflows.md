# Workflow Notes: OSS-First

## Default Order of Operations

1. Identify incumbent tools first (ffmpeg, imagemagick, pandoc, yt-dlp, rclone, rsync, jq)
2. If incumbent exists, search for wrappers only if:
   - user needs a GUI
   - user needs batch automation helpers
   - user needs a higher-level abstraction
3. If no incumbent, search GitHub and shortlist 2 to 5 candidates

## Always Prefer the Simplest Solution

- If a single CLI command solves it, do not propose writing code.
- If setup time is high, propose a docker image if available.
- If the user is non-technical, prioritize a GUI with active maintenance.
