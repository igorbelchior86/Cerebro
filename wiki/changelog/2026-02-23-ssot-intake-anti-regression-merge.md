# SSOT Intake Anti Regression Merge
# What changed
- Added a post-builder anti-regression merge for `ticket_ssot` in `PrepareContext`.
- The merge preserves known intake values when SSOT fields would otherwise degrade to `unknown`.
- Protected fields include core ticket/intake metadata such as company, requester identity, emails, title, description, and created timestamp.

# Why it changed
- The left sidebar (intake/listing) showed correct company/requester data, while center/right UI (SSOT-driven) showed `unknown`, proving the pipeline was regressing known values.
- SSOT must be the source of truth, so it cannot lose reliable intake information during later enrichment/fusion rounds.

# Impact (UI / logic / data)
- UI: Center and right panels should stop showing `unknown` for basic intake fields that are already known in the ticket source.
- Logic: SSOT generation is now monotonic for protected intake fields (enrichment can improve, but not regress to `unknown`).
- Data: Future `ticket_ssot` payloads will retain intake values even when enrichment rounds fail to resolve additional context.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-02-23
