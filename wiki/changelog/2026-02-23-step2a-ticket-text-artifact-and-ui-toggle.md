# Step 2A Ticket Text Artifact and UI Toggle
# What changed
Implemented a separate ticket text artifact for Prepare Context round-0 normalization (`ticket_text_artifacts`) to store original intake text, clean text, and UI-reinterpreted text without mixing it into SSOT (`itglue_org_enriched`). Exposed the artifact in `/playbook/full-flow` and added a premium toggle in the middle-column Autotask message header (next to the timestamp) to switch between reinterpreted and original text.
# Why it changed
The Prepare Context contract for step 2A requires dual normalization outputs with the UI reinterpretation stored separately from the canonical SSOT. The technician needs a primary simplified view with one-click access to the original intake text for auditability.
# Impact (UI / logic / data)
UI: Autotask timeline message now shows a premium toggle chip beside the timestamp to switch `Reframed`/`Original`.
Logic: Round-0 normalization persists a dedicated ticket text artifact during Prepare Context.
Data: New table `ticket_text_artifacts` (separate artifact store); `/playbook/full-flow` now returns `data.ticket_text_artifact`.
# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/playbook.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/db/migrations/011_ticket_text_artifacts.sql
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatMessage.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
# Date
2026-02-23
