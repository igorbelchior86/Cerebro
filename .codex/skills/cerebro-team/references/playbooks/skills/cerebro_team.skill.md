---
name: cerebro-team
description: Multi-agent team orchestrator for the Cerebro project. Orchestration-only at the top; specialists produce technical content. Enforces evidence-first gates.
version: 1.0.0
---

# Cerebro Team Skill (entrypoint)

## What this skill is
This is a multi-agent "team" for Cerebro with one orchestration workflow and five specialist agents.

### Motto
High functionality, few bugs.

### Inspiration
`.agent/` workflow/agent separation inspired by antigravity-kit.

## Entrypoint
- Workflow: `.agent/workflows/cerebro_orchestrator.md`

## Agents
- `.agent/agents/productlead.md`
- `.agent/agents/backendlead.md`
- `.agent/agents/aisystems.md`
- `.agent/agents/frontendlead.md`
- `.agent/agents/reliability.md`

## Hard rules
- Orchestrator must involve at least **3 distinct agents** per change.
- Every change has **1 primary owner** and at least **2 cross-domain reviewers**.
- Reliability participates as **final gate** on every change.
- No Evidence Pack, no "done".

## Outputs
The orchestrator always produces:
- CHANGE_BRIEF
- AGENT_PLAN
- DESIGN_DECISIONS
- IMPLEMENTATION_ROUTING
- EVIDENCE_PACK (template filled)
- ORCHESTRATION_REPORT
