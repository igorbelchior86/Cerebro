# Title
Thin Route Layer Delegation for Playbook, Autotask, Auth, and Ticket Intake

# What changed
Moved the full handler implementations from four heavy route files into `apps/api/src/services/application/route-handlers/` modules:
- `playbook-route-handlers.ts`
- `autotask-route-handlers.ts`
- `auth-route-handlers.ts`
- `ticket-intake-route-handlers.ts`

Route files were reduced to explicit delegation-only modules:
- `apps/api/src/routes/ai/playbook.ts`
- `apps/api/src/routes/integrations/autotask.ts`
- `apps/api/src/routes/identity/auth.ts`
- `apps/api/src/routes/ingestion/ticket-intake.ts`

`apps/api/src/services/adapters/ticket-intake-polling.ts` now imports ingestion/backfill entrypoints from the service handler module instead of importing from route files.

# Why it changed
To enforce a thin route layer: route modules now act as transport adapters only, while business/workflow logic lives under `services/`.

# Impact (UI / logic / data)
- UI: No expected UI behavior changes.
- logic: Request/response contracts were preserved; logic was relocated out of route modules.
- data: No schema or migration changes.

# Files touched
- apps/api/src/routes/ai/playbook.ts
- apps/api/src/routes/integrations/autotask.ts
- apps/api/src/routes/identity/auth.ts
- apps/api/src/routes/ingestion/ticket-intake.ts
- apps/api/src/services/application/route-handlers/playbook-route-handlers.ts
- apps/api/src/services/application/route-handlers/autotask-route-handlers.ts
- apps/api/src/services/application/route-handlers/auth-route-handlers.ts
- apps/api/src/services/application/route-handlers/ticket-intake-route-handlers.ts
- apps/api/src/services/adapters/ticket-intake-polling.ts

# Date
2026-03-02
