# Lint Warning Reduction Round 1
# What changed
- Removed the last lint warnings in the web app triage home page by replacing loose `any` casts with explicit frontend types.
- Cleaned small API warning clusters in recently changed files such as auth, platform admin, seed, tenant slug, ticket normalizer, history resolver, and LLM adapter.
- Replaced the legacy `apps/api/src/services/prepare-context.ts` implementation with a thin compatibility facade that re-exports the active `services/context/*` implementation and shared types.
- Removed repeated dead imports, dead constants, and useless regex escapes across context helpers and route handlers.

# Why it changed
- The repo still had a large volume of old lint warnings, which made new problems harder to see.
- The legacy `prepare-context.ts` file duplicated a large body of code and concentrated hundreds of warnings that no longer reflected the active implementation path.
- Mechanical cleanup on low-risk files reduces noise without changing product behavior.

# Impact (UI / logic / data)
- UI: no user-visible behavior change; the web triage home page kept the same behavior and now lint-checks cleanly.
- Logic: the legacy `prepare-context.ts` path now delegates to the current context implementation through explicit re-exports.
- Data: no schema or stored-data changes.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `apps/api/src/services/application/route-handlers/auth-route-handlers.ts`
- `apps/api/src/db/seed-admin.ts`
- `apps/api/src/services/application/route-handlers/platform-admin-route-handlers.ts`
- `apps/api/src/services/identity/tenant-slug.ts`
- `apps/api/src/services/prepare-context.ts`
- `apps/api/src/services/context/prepare-context.ts`
- `apps/api/src/services/context/enrichment-cache.ts`
- `apps/api/src/services/context/ticket-normalizer.ts`
- `apps/api/src/services/context/history-resolver.ts`
- `apps/api/src/services/context/prepare-context-helpers.ts`
- `apps/api/src/services/ai/llm-adapter.ts`
- `apps/api/src/services/adapters/autotask-text-normalizer.ts`
- `apps/api/src/services/autotask-text-normalizer.ts`
- `apps/api/src/services/application/route-handlers/ticket-intake-route-handlers.ts`
- `tasks/todo.md`

# Date
- 2026-03-06
