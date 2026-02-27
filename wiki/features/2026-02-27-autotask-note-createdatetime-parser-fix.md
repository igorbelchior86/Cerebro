# Autotask Note createDateTime Parser Fix
# What changed
- Updated `/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx` to read Autotask note timestamps from `createDateTime` (with fallback to legacy fields).
- Updated workflow-rule filtering to explicitly exclude `noteType = 13` in addition to the text-based heuristic.

# Why it changed
- The missing `2:22 PM` note (`Service Desk Notification`) was confirmed to exist in Autotask, but the frontend parser was reading the wrong timestamp field.
- Autotask `ticket notes` payload uses `createDateTime`, not `createDate`, for this record shape.

# Impact (UI / logic / data)
- UI: Autotask notes now sort/render in the correct place in the feed timeline.
- Logic: More accurate provider parsing and more deterministic filtering of workflow-rule noise.
- Data: No schema changes.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`
- `wiki/features/2026-02-27-autotask-note-createdatetime-parser-fix.md`

# Date
- 2026-02-27
