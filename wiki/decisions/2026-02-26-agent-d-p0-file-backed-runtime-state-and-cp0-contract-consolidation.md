# Title
Agent D Decision: File-Backed P0 Runtime State + CP0 Contract Consolidation (Trust Layer)

# What changed
- Adopted bounded file-backed JSON persistence as the P0 durability layer for workflow runtime and trust store state.
- Introduced `p0-trust-contracts.ts` to define Agent C trust-layer types as CP0-based contracts/extensions instead of independent duplicate models.
- Normalized trust-layer audit/AI decision correlation emission to always include `trace_id` for CP0 contract conformance.

# Why it changed
- Full DB-backed persistence for workflow/trust runtime state is larger than P0 hardening scope and would increase migration/runtime risk.
- Agent C trust-layer models drifted semantically from CP0 shared contracts (notably audit/AI decision primitives and correlation semantics).

# Impact (UI / logic / data)
- UI: No UI schema break intended.
- Logic: CP0 contract rules (required `trace_id`, structured `signals_used`, CP0 actor/audit fields) are enforced at trust-layer emit points.
- Data: Local persisted runtime snapshots are operator-visible and restart-resilient for internal validation.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/p0-trust-contracts.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/p0-ai-triage-assist.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/p0-readonly-enrichment.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/p0-manager-ops-visibility.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/p0-trust-store.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/manager-ops.ts

# Date
2026-02-26

