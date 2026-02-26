# Title
P0 Decisions: HITL Gate Defaults, Read-Only Enforcement, and In-Memory Trust Store

# What changed
- Set default P0 HITL triggers in AI triage assist service:
  - confidence below `0.70`
  - priority in `Critical`/`High`
  - non-approved validation status
  - presence of high-risk recommended actions
- Enforced explicit rejection (`403` in route path) for mutation attempts against IT Glue, Ninja, SentinelOne, and Check Point in P0 with audit records.
- Chose bounded in-memory storage for P0 audit/AI decision records instead of DB persistence.

# Why it changed
- P0 requires suggestion-first AI with visible human review gates and strict non-Autotask read-only behavior.
- In-memory store reduces delivery risk and schema churn while enabling manager validation workflows immediately.

# Impact (UI / logic / data)
- UI: Manager ops can inspect pending HITL and read-only rejection audits.
- Logic: AI policy outcome is linked to decision record (`pass` vs `hitl_required`) with reasons.
- Data: Records are ephemeral per process restart and not suitable for durable production analytics (follow-up item for Agent A/A+B convergence).

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/p0-ai-triage-assist.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/p0-readonly-enrichment.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/p0-trust-store.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/manager-ops.ts`

# Date
2026-02-26

