# Validation Defect Triage Template (Phase 4)

## Severity Rules (P0 Validation)

- `S0 - Launch Blocker`: tenant isolation breach, unsafe write behavior, missing auditability for critical workflow, hard-gate workflow failure (`F0-F4`) with no workaround
- `S1 - Critical`: P0 workflow works inconsistently / major regression / repeated validation failures; materially undermines launch confidence
- `S2 - Major`: workflow usable but with meaningful friction, missing evidence, or partial data quality issues; workaround exists
- `S3 - Minor`: cosmetic, low-impact friction, documentation/runbook issue, low-risk observability gap

## Go/No-Go Impact Tags

- `BLOCKS_LAUNCH`
- `CONDITIONAL_LAUNCH` (acceptable only with documented workaround + time-bounded fix plan)
- `NO_LAUNCH_IMPACT`

## Defect Entry Template

```markdown
### DEF-XXX - <short title>
- Date: YYYY-MM-DD
- Session ID: refresh-val-<id>
- Reported by: <name/role>
- Owner: <engineer/agent/founder>
- Severity: S0|S1|S2|S3
- Go/No-Go Impact: BLOCKS_LAUNCH | CONDITIONAL_LAUNCH | NO_LAUNCH_IMPACT
- Area: F0|F1|F2|F3|F4 | Autotask | IT Glue | Ninja | SentinelOne | Check Point | Platform/NFR
- Environment: local/dev/staging-like
- Tenant ID: <tenant>
- Ticket ID(s): <ids or N/A>
- Correlation ID(s): <ids>

#### Reproduction Steps
1. ...
2. ...
3. ...

#### Expected Behavior
- ...

#### Actual Behavior
- ...

#### Evidence
- JSON snapshots: `<path>`
- Logs/screenshots: `<path>`
- Related decision/audit IDs: `<ids>`

#### Impact Analysis
- User/operator impact:
- Safety/compliance impact:
- Workaround (if any):

#### Triage Outcome
- Status: New | Confirmed | In Progress | Fixed Pending Re-test | Closed | Deferred (P1/P2)
- Root cause hypothesis:
- Fix plan / next action:
- Re-test owner + ETA:
```

## Triage Loop (session-day)

1. Log defect during scenario execution (do not defer memory-only notes).
2. Assign severity + go/no-go impact immediately.
3. Link to acceptance matrix row(s) affected.
4. Decide session action: continue / workaround / stop scenario.
5. Re-test same session if fix is applied; otherwise carry to hardening backlog.
6. Update launch decision packet with open blockers and mitigations.
