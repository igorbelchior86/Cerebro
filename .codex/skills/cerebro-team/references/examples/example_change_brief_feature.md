# Example Change Brief (Feature)

Problem:
- Techs need a quick EvidencePack view to confirm what Cerebro collected.

Goal:
- Add an EvidencePack panel in the console with filters (logs/snapshots/config).

Non-goals:
- No AI reasoning changes.

Scope:
In:
- UI panel + API endpoint to fetch evidence list
Out:
- New evidence collectors

Systems touched:
- API: yes
- DB: yes (read paths)
- Redis/cache: yes (cache evidence list)
- AI/agents: no
- UI/web: yes
- Connectors: no

Risk level: Low

AC:
- EvidencePack panel loads within 2s on typical tenant.
- Clear loading/error/empty states.
- Filters work and are persisted per session.

Rollback:
- Feature flag off.

Evidence:
- UI screenshots
- API integration test
- Cache key tenant-scoped verification
