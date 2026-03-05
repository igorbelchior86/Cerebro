# Title
Route Layer as Thin Controllers via Service Delegation

# What changed
Established a delegation boundary where route modules in `apps/api/src/routes/**` no longer embed business/workflow logic for the targeted surfaces (`playbook`, `autotask`, `auth`, `ticket-intake`).

Implementation details:
- Route modules now export service-backed routers from `apps/api/src/services/application/route-handlers/**`.
- Business and orchestration flows are hosted under `services/application/route-handlers` for these endpoints.
- Background polling integration (`ticket-intake-polling`) was updated to consume service entrypoints directly, eliminating route-layer dependency in service code.

# Why it changed
To enforce separation of concerns and lower coupling:
- routes = HTTP boundary/adaptation
- services = business/workflow orchestration

This aligns with the operational goal of thin controllers and explicit service ownership.

# Impact (UI / logic / data)
- UI: no direct impact.
- logic: flow logic location changed from `routes/` to `services/`; endpoint semantics and payload shape are intended to remain unchanged.
- data: no table/column changes.

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
