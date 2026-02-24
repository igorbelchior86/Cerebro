# Title
Cerebro Concurrency / Race Audit Skill

# What changed
Added a new repo-local skill at `.codex/skills/cerebro-concurrency-race-auditor/` to audit race conditions and concurrency issues in the Cerebro Node/TypeScript backend.

The skill includes:
- `SKILL.md` with a project-specific workflow for concurrency investigation
- `agents/openai.yaml` metadata for invocation UX
- `scripts/concurrency_hotspots.py` for static hotspot scanning
- `scripts/http_burst.mjs` for concurrent HTTP burst reproduction
- `references/` docs with Cerebro-specific hotspots, checklist, and documentation basis

# Why it changed
The project has several concurrency-sensitive flows (pollers, background pipeline execution, retry listeners, shared DB state transitions, and AsyncLocalStorage tenant context). A dedicated skill makes audits repeatable and less generic.

# Impact (UI / logic / data)
UI: None
logic: Adds developer tooling/workflow only (no runtime behavior changes)
data: None

# Files touched
- `.codex/skills/cerebro-concurrency-race-auditor/SKILL.md`
- `.codex/skills/cerebro-concurrency-race-auditor/agents/openai.yaml`
- `.codex/skills/cerebro-concurrency-race-auditor/scripts/concurrency_hotspots.py`
- `.codex/skills/cerebro-concurrency-race-auditor/scripts/http_burst.mjs`
- `.codex/skills/cerebro-concurrency-race-auditor/references/cerebro-api-hotspots.md`
- `.codex/skills/cerebro-concurrency-race-auditor/references/concurrency-review-checklist.md`
- `.codex/skills/cerebro-concurrency-race-auditor/references/context7-basis.md`
- `wiki/features/cerebro-concurrency-race-audit-skill.md`

# Date
2026-02-24
