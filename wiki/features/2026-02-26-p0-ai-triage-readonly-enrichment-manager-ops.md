# Title
P0 Trust Layer: AI Triage Suggestions, Read-Only Enrichment, and Manager Ops Visibility

# What changed
- Added P0 AI triage/assist service that creates auditable suggestion-first decision records with confidence, rationale, provenance refs, prompt/model versions, and HITL status.
- Added P0 read-only enrichment service for IT Glue, Ninja, SentinelOne, and Check Point with normalized context cards/evidence and degraded-mode partial failure handling.
- Added manager ops visibility service/route endpoints for queue/SLA, AI audit summaries, automation audit summaries, and QA sampling snapshots.

# Why it changed
- P0 differentiation/trust layer requires auditable AI suggestions (not autonomous actions), explicit read-only enforcement for non-Autotask integrations, and manager validation visibility during internal rollout.

# Impact (UI / logic / data)
- UI: New manager-facing API surfaces available under `/manager-ops/p0/*` for internal validation dashboards/inspection.
- Logic: HITL policy triggers now computed from confidence/priority/validation/high-risk action signals in a dedicated service; read-only mutation attempts are explicitly rejected and audited.
- Data: In-memory P0 trust store holds recent AI decision records and audit records (tenant-scoped at read time); no DB migration added.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/packages/types/src/index.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/p0-trust-store.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/p0-ai-triage-assist.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/p0-readonly-enrichment.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/p0-manager-ops-visibility.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/manager-ops.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/index.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/p0-ai-triage-assist.test.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/p0-readonly-enrichment.test.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/p0-manager-ops-visibility.test.ts`

# Date
2026-02-26

