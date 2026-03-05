# 2026-02-24 Sidebar Suppressed Inline Filter Toggle
# What changed
- Added `suppressed` visibility toggle to the left sidebar list controls (default ON = hide suppressed).
- Suppressed tickets can now be shown inline in the existing ticket list with visual labeling (`SUPPRESSED`, reason, confidence).
- `/ticket-intake/list` now computes conservative heuristic suppression metadata for obvious noise categories (delivery bounces, quarantine digests, marketing promos).

# Why it changed
- Reduce queue noise without deleting tickets.
- Support safe `Suppress > Delete` workflow with auditability and lower risk of accidental loss.
- Prepare the UI for future Playbook Brain early triage gating while keeping current behavior reversible.

# Impact (UI / logic / data)
- UI: Sidebar list defaults to cleaner actionable view; operators can reveal suppressed items inline.
- Logic: Dual filtering (status + suppressed visibility) in `ChatSidebar`.
- Data: API list response includes suppression metadata fields for frontend rendering.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatSidebar.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/messages/en.json
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/ticket-intake.ts

# Date
2026-02-24
