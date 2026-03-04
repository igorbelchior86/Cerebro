# Cerebro Team Skill Import
# What changed
- Added a new skill at `.codex/skills/cerebro-team`.
- Imported `SKILL.md` and all `references/` artifacts from the provided `cerebro-team.zip` package.
- Removed macOS packaging artifacts (`.DS_Store`) from imported content.
- Normalized `SKILL.md` frontmatter to `name` + `description` for consistency with local skill conventions.

# Why it changed
- To make the provided orchestration skill directly available inside this Cerebro repository as requested.

# Impact (UI / logic / data)
- UI: none.
- Logic: no runtime app behavior changes; only Codex skill behavior/catalog changed.
- Data: none.

# Files touched
- `.codex/skills/cerebro-team/SKILL.md`
- `.codex/skills/cerebro-team/references/docs/engineering_principles.md`
- `.codex/skills/cerebro-team/references/docs/quality_gates.md`
- `.codex/skills/cerebro-team/references/docs/repo_conventions.md`
- `.codex/skills/cerebro-team/references/docs/work_rules.md`
- `.codex/skills/cerebro-team/references/examples/example_change_brief_feature.md`
- `.codex/skills/cerebro-team/references/examples/example_change_brief_fixer.md`
- `.codex/skills/cerebro-team/references/examples/example_evidence_pack.md`
- `.codex/skills/cerebro-team/references/examples/example_orchestration_report.md`
- `.codex/skills/cerebro-team/references/playbooks/agents/aisystems.md`
- `.codex/skills/cerebro-team/references/playbooks/agents/backendlead.md`
- `.codex/skills/cerebro-team/references/playbooks/agents/frontendlead.md`
- `.codex/skills/cerebro-team/references/playbooks/agents/productlead.md`
- `.codex/skills/cerebro-team/references/playbooks/agents/reliability.md`
- `.codex/skills/cerebro-team/references/playbooks/skills/cerebro_team.skill.md`
- `.codex/skills/cerebro-team/references/playbooks/workflows/cerebro_orchestrator.md`
- `.codex/skills/cerebro-team/references/playbooks/workflows/change_brief_template.md`
- `.codex/skills/cerebro-team/references/playbooks/workflows/evidence_pack_template.md`
- `tasks/todo.md`
- `wiki/changelog/2026-03-04-cerebro-team-skill-import.md`

# Date
- 2026-03-04
