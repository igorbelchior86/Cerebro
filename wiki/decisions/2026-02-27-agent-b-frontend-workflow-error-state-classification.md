# Decision: Frontend Workflow Error/State Classification Strategy
# What changed
- Adopted centralized frontend classification in `p0-ui-client` for workflow action failures.
- Decision rules:
  - `401` -> auth-required/read-only UX
  - `403` -> policy-forbidden/read-only UX
  - `429` -> retryable/rate-limit UX
  - `5xx` -> retryable/backend-failure UX
  - network/client exceptions -> retryable network UX
- Mapped command execution statuses to UX states with manual retry enabled on retryable paths.

# Why it changed
- Distributed per-component error handling made UX inconsistent and obscured next actions.
- A single decision layer reduces divergence and preserves deterministic behavior across inbox/ticket detail surfaces.

# Impact (UI / logic / data)
- UI: Errors are actionable, not generic; users can identify whether to retry or escalate permissions.
- Logic: Command lifecycle behavior is now explicit and testable via smoke assertions.
- Data: No data model migration; pure frontend orchestration change.

# Files touched
- apps/web/src/lib/p0-ui-client.ts
- apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- apps/web/scripts/workflow-ux-state-smoke.ts

# Date
- 2026-02-27
