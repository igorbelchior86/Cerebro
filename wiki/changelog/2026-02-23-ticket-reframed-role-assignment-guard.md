# Ticket Reframed Role Assignment Guard
# What changed
- Added a deterministic post-LLM guard for ticket `description_ui` normalization to prevent requester names from being incorrectly assigned as the affected user in third-party/new-employee requests.
- Strengthened the 2a normalization LLM prompt with an explicit rule: do not confuse requester and affected user; keep affected user unnamed when not explicitly provided.
- The guard rewrites reframed summaries when it detects a "new employee" style request plus third-party request wording and a requester name injected into the affected role.

# Why it changed
- Troubleshooting of ticket `T20260223.0006` showed the reframed text incorrectly stated that Nick Ryals was the new maintenance employee, when Nick is the requester opening the ticket for someone else.
- This is a semantic error that changes ticket meaning and can mislead technicians.

# Impact (UI / logic / data)
- UI: `Reframed` ticket text should now preserve requester/affected-user roles more accurately for onboarding/third-party requests.
- Logic: `2a` normalization is safer with a deterministic role-assignment guard after LLM output.
- Data: `ticket_text_artifacts.text_reinterpreted` will change on future refresh/reprocessing for affected tickets.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-02-23
