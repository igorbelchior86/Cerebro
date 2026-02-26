# Title
Sidebar Left Panel: Global/Personal Toggle with Queue Dropdown (UI-first)

# What changed
- Reduced the visual height of the `Active / Done Today / Avg Time` stat tiles.
- Added a real binary slider (`Personal` / `Global`) using a 2-position range slider (track + thumb) in the lower portion of the stats section, after replacing the initial segmented/toggle attempts.
- `Personal` mode keeps the current top controls for the ticket list (`All / Processing / Done / Failed` + suppressed filter button).
- `Global` mode replaces those controls with a queue dropdown, now populated from real Autotask queue options via `GET /autotask/queues` (with UI fallback when unavailable).
- Added optional ticket fields in the frontend type (`queue`, `queue_name`, `assigned_resource_*`) so the UI can immediately consume Autotask metadata when the backend starts sending it.
- Added fallback behavior: if queue/assignee metadata is not present yet, the UI keeps showing the current ticket list instead of going empty.

- Bugfix: the Global filter now separates queue catalog availability from ticket row queue metadata, preventing empty results when the dropdown is populated but ticket rows are not yet enriched with `queue_*`.
- Bugfix: when a queue option comes from the Autotask catalog (`queue:<id>`), label fallback matching now compares against the option label (e.g. `Triage`) instead of the internal option id, avoiding false-empty results.

- Bugfix: after checking the Autotask Tickets API docs (`queueID` is the canonical queue field), we found the sidebar pipeline was promoting a backend placeholder (`"Unknown"`) as `queue_name`; backend and frontend now ignore queue placeholders so Global filtering does not treat them as real queue metadata.

- Payload inspection (`/email-ingestion/list`) showed the sidebar was receiving pseudo-queue values (`"Email Ingestion"`) and no real `queue_id`; backend/frontend now treat `Email Ingestion` as a placeholder, but true queue filtering still depends on real Autotask queue metadata being hydrated into the list payload.
- Bugfix (wiring): `apps/api/src/routes/email-ingestion.ts` already had an on-demand queue hydration helper (Autotask lookup + cache), but `/email-ingestion/list` was not calling it. The route now invokes hydration before `res.json`, and the hydration limit was increased to match the list window (200 items) so queue-specific filtering can reflect the visible sidebar dataset.
- Bugfix (identifier mismatch): queue hydration originally assumed sidebar `ticket_id` was always the Autotask entity `id` and called `GET /tickets/{id}` only. Many sidebar rows carry the Autotask `ticketNumber` (e.g. `T20260225.0013`), so hydration now detects `ticketNumber` format and resolves by `ticketNumber` query (with fallback for numeric strings that are not entity IDs).
- Investigation result (Autotask vs sidebar): after the identifier fix, queue metadata hydration succeeds for the sidebar payload (no remaining `missingQueue` in the tested local dataset). Remaining differences between Autotask queue views and Cerebro sidebar are due to ingestion coverage: some tickets visible in Autotask today were not yet present in `tickets_processed`, `triage_sessions`, or `ticket_ssot`, so they cannot appear in the sidebar regardless of queue filtering.
- UI identifier fix: sidebar ticket display now prioritizes the Autotask `ticketNumber` (`TYYYYMMDD.NNNN`) instead of the internal numeric Autotask entity id. The payload keeps the internal `id` for selection/actions and exposes/uses `ticket_number` + `ticket_id` (display) for operator-facing UI.
- Global source upgrade (Step 1): when a specific queue is selected in `Global`, the sidebar now fetches tickets directly from Autotask via `GET /autotask/sidebar-tickets?queueId=...` instead of relying on the Cerebro pipeline list payload. `All queues` intentionally stays on the Cerebro list for now.
- Backfill/reconciliation (Step 2): added `POST /autotask/backfill-recent` to reconcile recent Autotask tickets with Cerebro coverage (`tickets_processed` / `triage_sessions` / `ticket_ssot`). It supports `dryRun` and `runPipeline` flags so operators can seed sidebar coverage safely before triggering full pipeline runs.
- Direct Global recency guard: the direct Autotask queue endpoint defaults to a `lookbackHours` window (30 days) because Autotask paging/query ordering can otherwise return very old historical tickets first, which is poor sidebar UX.

# Why it changed
- The team wants to validate the interaction model (Global vs Personal views) before implementing the full Autotask management layer.
- This de-risks the upcoming backend integration by letting product/UI iterate on the sidebar behavior first.

# Impact (UI / logic / data)
- UI: New scope switcher in the stats card and conditional controls in the ticket list header.
- Logic: Ticket filtering now supports two scopes:
  - `Personal`: filters by assigned technician when assignment metadata exists.
  - `Global`: filters by selected queue when queue metadata exists.
- Data: Added backend API `GET /autotask/queues` (Autotask `Tickets.queueID` picklist metadata) and frontend queue catalog fetch in `ChatSidebar`. The sidebar list payload now also includes `queue`, `queue_name`, `queue_id`, and `assigned_resource_*` when available, so Global/Personal filtering can apply to real Autotask metadata.
- Data/logic: the legacy pseudo-queue label `Email Ingestion` is explicitly blocked from being treated as queue metadata in filtering paths. Queue hydration is now executed inside the sidebar list route (with cache), not just defined as dead helper code.
- Data/logic: queue hydration now supports both Autotask entity `id` and `ticketNumber` lookups, which is required because the sidebar payload `ticket_id` may contain the displayed `ticketNumber` string (`TYYYYMMDD.NNNN`) instead of the internal numeric entity id.
- UI/data contract: `id` remains the internal/stable identifier used for selection, while `ticket_id` (display) and `ticket_number` now prefer the canonical Autotask `ticketNumber` so the sidebar matches what technicians see in Autotask.
- Data source split by scope:
  - `Personal` and `Global / All queues`: Cerebro pipeline list payload (`/email-ingestion/list`, legacy route name).
  - `Global / specific queue`: direct Autotask queue query (`/autotask/sidebar-tickets`) with sidebar-shape normalization.
- Reconciliation impact (local validation): after seeding recent missing Autotask tickets into `tickets_processed`, the sidebar list increased from 175 to 196 items and all tested “today” Autotask tickets matched the sidebar coverage.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatSidebar.tsx`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/messages/en.json`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/clients/autotask.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/autotask.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/email-ingestion.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/autotask.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatSidebar.tsx`

# Date
2026-02-25
