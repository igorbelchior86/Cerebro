# New Ticket Primary Tech Deterministic Search Guard
# What changed
- Updated `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx` context-editor search flow.
- Added request dedupe guards with `useRef`:
  - `inFlightContextSearchRef` prevents concurrent duplicate requests for the same search key.
  - `completedContextSearchRef` prevents repeated re-fetch for an already completed identical key.
- Search key is deterministic: `activeContextEditor|activeOrgId|contextEditorQuery`.
- Reset in-flight marker when opening/closing context editor.

# Why it changed
- Even after dependency stabilization, identical fetches could still re-trigger and keep "Searching Autotask" active most of the time.
- The modal required an explicit idempotency guard in the client effect to stop redundant requests.

# Impact (UI / logic / data)
- UI: Primary tech modal avoids repeated spinner cycles for identical search state.
- Logic: One fetch per key/state, deterministic behavior under re-renders.
- Data: No API/schema/storage changes.

# Files touched
- apps/web/src/app/[locale]/(chat)/triage/home/page.tsx

# Date
- 2026-03-02
