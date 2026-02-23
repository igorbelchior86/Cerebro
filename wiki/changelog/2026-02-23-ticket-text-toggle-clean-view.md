# Ticket Text Toggle Clean View
# What changed
- The center-column Autotask message now passes `ticket_text_artifact.text_clean` into the premium ticket-text toggle.
- The ticket text toggle supports and displays three modes when available: `Reframed`, `Clean`, and `Original`.
- Timeline signature serialization now includes the `clean` variant so UI state refreshes correctly when the cleanup text changes.

# Why it changed
- Troubleshooting of ticket `T20260223.0006` showed the backend cleanup (`text_clean`) was being generated, but the UI only exposed `Reframed` and `Original`.
- This made the user perceive the cleanup fix as not working, because the improved `text_clean` output was hidden.

# Impact (UI / logic / data)
- UI: Technicians can inspect the cleaned ticket text directly in the center column without losing access to the original raw email.
- Logic: No backend behavior change; frontend now consumes an existing artifact field.
- Data: No schema change. Existing `ticket_text_artifacts.text_clean` is now surfaced in the UI.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatMessage.tsx`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`

# Date
- 2026-02-23
