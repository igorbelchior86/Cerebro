# Workflow Action State Model for Frontend UX Hardening
# What changed
- Introduced a frontend state bridge between backend command statuses (`accepted`, `processing`, `retry_pending`, `failed`, `dlq`, `rejected`, `completed`) and UX states (`pending`, `retrying`, `failed`, `succeeded`).
- Added a centralized HTTP error classifier for workflow UI actions to normalize `401/403/429/5xx/network` handling.
- Added command-status polling loop in triage detail to keep action feedback synchronized during retries.

# Why it changed
- Existing rendering handled runtime errors as ad-hoc strings and did not preserve operator-level semantics for recovery.
- The hardening goal required deterministic transitions and explicit operator actions under degraded conditions.

# Impact (UI / logic / data)
- UI: Consistent action-state rendering and retry affordances.
- Logic: Single mapping function controls frontend status interpretation; reduced duplicated error parsing.
- Data: Existing API payload shape reused; no protocol extension required.

# Files touched
- apps/web/src/lib/p0-ui-client.ts
- apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- apps/web/src/components/p0/P0WorkflowTicketPage.tsx

# Date
- 2026-02-27
