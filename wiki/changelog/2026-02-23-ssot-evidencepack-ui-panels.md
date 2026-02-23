# SSOT EvidencePack + UI Panels
# What changed
- EvidencePack ticket/org/user fields now prefer SSOT values when available.
- Triage UI (left list + center + right panel) now prioritizes SSOT fields for display.
- Email ingestion list endpoint merges SSOT payload into list rows.

# Why it changed
- Ensure a single source of truth for ticket identity and core fields across all UI panels.
- Remove drift between processed tickets, evidence pack, and UI snapshots.

# Impact (UI / logic / data)
- UI: Left list, timeline header, and playbook context now use SSOT for ticket fields.
- Logic: PrepareContext writes SSOT and builds EvidencePack from SSOT fields.
- Data: `ticket_ssot` is read by list and full-flow endpoints.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/email-ingestion.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/features/ssot-evidencepack-ui-panels.md

# Date
- 2026-02-23
