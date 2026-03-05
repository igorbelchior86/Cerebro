# Pipeline-only Ticket Flow Stabilization
# What changed
- Enforced a single source for sidebar ticket cards in `GET /ticket-intake/list`: latest pipeline session per `ticket_id`.
- Removed `tickets_raw` enrichment fallback and multi-source union (`fromSessions + fromProcessed`) from list assembly.
- Made field precedence deterministic: processed ticket fields first, pipeline evidence fields only when processed values are missing.
- Changed evidence lookup to use the latest evidence pack available for the same ticket across sessions (pipeline-only continuity on retries).
- Stabilized chronology source for sidebar cards to immutable ticket timeline (`tickets_processed.created_at` fallback to first session creation per ticket), removing mutable timestamp sources that caused reordering.
- Added per-ticket UI snapshot freeze in triage center timeline so polling never downgrades displayed metadata (e.g., rich ticket text to `Untitled/Unknown`) once meaningful values were resolved.
- Hardened `GET /playbook/full-flow` artifact reads to always select the latest row (`ORDER BY created_at DESC LIMIT 1`) for evidence/diagnosis/validation/playbook, removing nondeterministic row selection when multiple artifacts exist.
- Added canonical `session` payload in full-flow response so UI can bind to backend-resolved ticket/session identity instead of inferring from transient local state.
- Added canonical `ticket` payload in full-flow response and switched triage center timeline to consume this backend payload as primary source, removing center-vs-sidebar split-brain for ticket metadata.
- Removed triage-page local card fallback (`currentMock`) and local field-quality merge heuristic so sidebar now reflects API snapshot only.
- Reduced sidebar clock update frequency to avoid constant full-sidebar re-render pressure.

# Why it changed
- The UI was oscillating between raw/normalized values and occasionally dropping/reappearing cards due concurrent/fallback data paths.
- Stats (active/done) changed without operational reason because temporary fallback cards altered the in-memory list.
- A strict `pipeline or nothing` flow was required.

# Impact (UI / logic / data)
- UI: Sidebar and center context become stable and deterministic; no synthetic ticket cards injected locally.
- Logic: Ticket list API is now pipeline-centered (latest session per ticket) with deterministic field resolution.
- Data: No schema changes; only read/assembly logic changed.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/ticket-intake.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatSidebar.tsx

# Date
- 2026-02-21
